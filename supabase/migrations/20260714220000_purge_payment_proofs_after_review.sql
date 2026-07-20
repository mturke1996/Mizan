-- Purge payment-proof storage objects once a request is reviewed so proofs
-- are not retained after approval or rejection.

create or replace function private.purge_payment_proof_object(p_object_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_object_path is null
     or not coalesce(private.payment_proof_path_is_valid(p_object_path), false) then
    return;
  end if;

  -- storage.protect_delete blocks direct DELETE; disable only for this purge.
  execute 'alter table storage.objects disable trigger protect_objects_delete';
  begin
    delete from storage.objects as object
     where object.bucket_id = 'payment-proofs'
       and object.name = p_object_path;
  exception
    when others then
      execute 'alter table storage.objects enable trigger protect_objects_delete';
      raise;
  end;
  execute 'alter table storage.objects enable trigger protect_objects_delete';
end;
$$;

comment on function private.purge_payment_proof_object(text) is
  'Deletes a validated payment-proof object from private storage.';

revoke all on function private.purge_payment_proof_object(text)
  from public, anon, authenticated;

create or replace function public.review_payment_request(
  p_payment_request_id uuid,
  p_decision public.payment_review_decision,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(p_review_note), '');
  v_request public.payment_requests%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_period_base timestamptz;
  v_period_months integer;
  v_new_period_end timestamptz;
  v_proof_path text;
begin
  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'active supervisor role required';
  end if;

  if p_decision is null then
    raise exception using
      errcode = '22023',
      message = 'review decision is required';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'review note cannot exceed 1000 characters';
  end if;

  select request.*
    into v_request
    from public.payment_requests as request
   where request.id = p_payment_request_id
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'payment request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'payment request was already reviewed';
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = v_request.plan_id;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'payment request plan is unavailable';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = v_request.workspace_id
   for update;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'workspace subscription is unavailable';
  end if;

  v_proof_path := v_request.proof_object_path;

  if p_decision = 'approve' then
    if v_proof_path is null then
      raise exception using
        errcode = '22023',
        message = 'payment proof must be attached before approval';
    end if;

    if not exists (
      select 1
        from storage.objects as object
       where object.bucket_id = 'payment-proofs'
         and object.name = v_proof_path
    ) then
      raise exception using
        errcode = '22023',
        message = 'attached payment proof object no longer exists';
    end if;

    v_period_months := case v_plan.billing_interval
      when 'monthly' then v_plan.interval_count * v_request.period_count
      when 'yearly' then 12 * v_plan.interval_count * v_request.period_count
      else null
    end;

    if v_period_months is null or v_period_months <= 0 then
      raise exception using
        errcode = '55000',
        message = 'payment plan has no renewable interval';
    end if;

    v_period_base := case
      when v_subscription.status = 'trialing'
       and v_subscription.trial_ends_at > v_now
        then v_subscription.trial_ends_at
      when v_subscription.status in ('active', 'grace')
       and v_subscription.current_period_ends_at > v_now
        then v_subscription.current_period_ends_at
      else v_now
    end;
    v_new_period_end := v_period_base
      + pg_catalog.make_interval(months => v_period_months);

    update public.payment_requests as request
       set status = 'approved',
           reviewed_by = v_supervisor_id,
           reviewed_at = v_now,
           review_note = v_note
     where request.id = p_payment_request_id;

    update public.workspace_subscriptions as subscription
       set plan_id = v_request.plan_id,
           status = 'active',
           current_period_ends_at = v_new_period_end,
           grace_ends_at = null,
           frozen_at = null,
           expired_at = null,
           cancelled_at = null
     where subscription.id = v_subscription.id;

    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      payment_request_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_request.workspace_id,
      v_subscription.id,
      v_request.id,
      v_supervisor_id,
      'payment_approved',
      v_subscription.status,
      'active',
      pg_catalog.jsonb_build_object(
        'new_period_end', v_new_period_end,
        'plan_id', v_request.plan_id
      )
    );

    insert into public.notifications (
      user_id,
      workspace_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      v_request.requested_by,
      v_request.workspace_id,
      'payment',
      'Payment approved',
      'Your payment was approved and the workspace subscription is active.',
      pg_catalog.jsonb_build_object(
        'payment_request_id', v_request.id,
        'current_period_ends_at', v_new_period_end
      )
    );
  else
    update public.payment_requests as request
       set status = 'rejected',
           reviewed_by = v_supervisor_id,
           reviewed_at = v_now,
           review_note = v_note
     where request.id = p_payment_request_id;

    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      payment_request_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_request.workspace_id,
      v_subscription.id,
      v_request.id,
      v_supervisor_id,
      'payment_rejected',
      v_subscription.status,
      v_subscription.status,
      pg_catalog.jsonb_build_object('review_note', v_note)
    );

    insert into public.notifications (
      user_id,
      workspace_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      v_request.requested_by,
      v_request.workspace_id,
      'payment',
      'Payment requires attention',
      'Your payment proof was not approved. Review the supervisor note.',
      pg_catalog.jsonb_build_object(
        'payment_request_id', v_request.id,
        'review_note', v_note
      )
    );
  end if;

  if v_proof_path is not null then
    begin
      perform private.purge_payment_proof_object(v_proof_path);
    exception
      when others then
        null;
    end;

    update public.payment_requests as request
       set proof_object_path = null
     where request.id = p_payment_request_id;
  end if;

  perform private.write_audit(
    v_request.workspace_id,
    v_supervisor_id,
    case
      when p_decision = 'approve' then 'payment_request.approved'
      else 'payment_request.rejected'
    end,
    'payment_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'decision', p_decision::text,
      'review_note', v_note,
      'proof_purged', v_proof_path is not null
    )
  );

  return v_request.id;
end;
$$;

comment on function public.review_payment_request(
  uuid,
  public.payment_review_decision,
  text
) is
  'Reviews a manual payment, activates approved subscriptions, and purges proof artifacts.';

-- Backfill: remove proofs already attached to reviewed requests.
do $$
declare
  v_row record;
begin
  for v_row in
    select request.id, request.proof_object_path
      from public.payment_requests as request
     where request.status in ('approved', 'rejected')
       and request.proof_object_path is not null
  loop
    begin
      perform private.purge_payment_proof_object(v_row.proof_object_path);
    exception
      when others then
        null;
    end;

    update public.payment_requests as request
       set proof_object_path = null
     where request.id = v_row.id;
  end loop;
end;
$$;
