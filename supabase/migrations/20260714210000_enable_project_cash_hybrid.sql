-- Enable project treasury by default for projects that still have cash_mode = off.
-- Safe to re-run: only touches rows currently in the 'off' state.
update public.projects
set
  cash_mode = 'hybrid'::public.project_cash_mode,
  updated_at = clock_timestamp()
where cash_mode = 'off'::public.project_cash_mode;
