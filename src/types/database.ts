// Manually maintained until `npm run supabase:types` can regenerate this file
// from a running local stack.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      currencies: Table<
        {
          code: string;
          name: string;
          minor_unit: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          code: string;
          name: string;
          minor_unit: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          code?: string;
          name?: string;
          minor_unit?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      profiles: Table<
        {
          id: string;
          system_role: Database["public"]["Enums"]["system_role"];
          account_status: Database["public"]["Enums"]["account_status"];
          display_name: string | null;
          avatar_url: string | null;
          locale: string;
          timezone: string;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          system_role?: Database["public"]["Enums"]["system_role"];
          account_status?: Database["public"]["Enums"]["account_status"];
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
        }
      >;
      workspaces: Table<
        {
          id: string;
          name: string;
          default_currency_code: string;
          status: Database["public"]["Enums"]["workspace_status"];
          legal_name: string | null;
          phone: string | null;
          address: string | null;
          tax_id: string | null;
          invoice_footer: string | null;
          logo_path: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          default_currency_code?: string;
          status?: Database["public"]["Enums"]["workspace_status"];
          legal_name?: string | null;
          phone?: string | null;
          address?: string | null;
          tax_id?: string | null;
          invoice_footer?: string | null;
          logo_path?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          default_currency_code?: string;
          legal_name?: string | null;
          phone?: string | null;
          address?: string | null;
          tax_id?: string | null;
          invoice_footer?: string | null;
          logo_path?: string | null;
        }
      >;
      workspace_members: Table<
        {
          id: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["workspace_role"];
          status: Database["public"]["Enums"]["workspace_member_status"];
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["workspace_member_status"];
          created_at?: string;
          updated_at?: string;
        },
        {
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["workspace_member_status"];
        }
      >;
      subscription_plans: Table<
        {
          id: string;
          code: string;
          name: string;
          price_minor: number;
          currency_code: string;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          interval_count: number | null;
          trial_days: number;
          is_public: boolean;
          is_active: boolean;
          features: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          code: string;
          name: string;
          price_minor: number;
          currency_code: string;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          interval_count?: number | null;
          trial_days?: number;
          is_public?: boolean;
          is_active?: boolean;
          features?: Json;
          created_at?: string;
          updated_at?: string;
        },
        {
          code?: string;
          name?: string;
          price_minor?: number;
          currency_code?: string;
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          interval_count?: number | null;
          trial_days?: number;
          is_public?: boolean;
          is_active?: boolean;
          features?: Json;
        }
      >;
      workspace_subscriptions: Table<
        {
          id: string;
          workspace_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          starts_at: string;
          trial_ends_at: string | null;
          current_period_ends_at: string | null;
          grace_ends_at: string | null;
          frozen_at: string | null;
          expired_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          starts_at: string;
          trial_ends_at?: string | null;
          current_period_ends_at?: string | null;
          grace_ends_at?: string | null;
          frozen_at?: string | null;
          expired_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          starts_at?: string;
          trial_ends_at?: string | null;
          current_period_ends_at?: string | null;
          grace_ends_at?: string | null;
          frozen_at?: string | null;
          expired_at?: string | null;
          cancelled_at?: string | null;
        }
      >;
      payment_requests: Table<
        {
          id: string;
          workspace_id: string;
          requested_by: string;
          plan_id: string;
          period_count: number;
          amount_minor: number;
          currency_code: string;
          proof_object_path: string | null;
          status: Database["public"]["Enums"]["payment_request_status"];
          requester_note: string | null;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          requested_by: string;
          plan_id: string;
          period_count?: number;
          amount_minor: number;
          currency_code: string;
          proof_object_path?: string | null;
          status?: Database["public"]["Enums"]["payment_request_status"];
          requester_note?: string | null;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          proof_object_path?: string | null;
          status?: Database["public"]["Enums"]["payment_request_status"];
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        }
      >;
      subscription_events: Table<
        {
          id: string;
          workspace_id: string;
          subscription_id: string;
          payment_request_id: string | null;
          actor_user_id: string | null;
          event_type: string;
          from_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null;
          to_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          subscription_id: string;
          payment_request_id?: string | null;
          actor_user_id?: string | null;
          event_type: string;
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null;
          to_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        },
        never
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          workspace_id: string | null;
          kind: Database["public"]["Enums"]["notification_kind"];
          title: string;
          body: string;
          metadata: Json;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          workspace_id?: string | null;
          kind?: Database["public"]["Enums"]["notification_kind"];
          title: string;
          body: string;
          metadata?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          read_at?: string | null;
        }
      >;
      projects: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          goal_minor: number | null;
          color_token: string;
          status: Database["public"]["Enums"]["project_status"];
          project_type: string;
          modules: Json;
          parent_project_id: string | null;
          cash_mode: Database["public"]["Enums"]["project_cash_mode"];
          linked_wallet_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          goal_minor?: number | null;
          color_token?: string;
          status?: Database["public"]["Enums"]["project_status"];
          project_type?: string;
          modules?: Json;
          parent_project_id?: string | null;
          cash_mode?: Database["public"]["Enums"]["project_cash_mode"];
          linked_wallet_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          description?: string | null;
          goal_minor?: number | null;
          color_token?: string;
          status?: Database["public"]["Enums"]["project_status"];
          project_type?: string;
          modules?: Json;
          parent_project_id?: string | null;
          cash_mode?: Database["public"]["Enums"]["project_cash_mode"];
          linked_wallet_id?: string | null;
        }
      >;
      project_workers: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          phone: string | null;
          daily_wage_minor: number;
          status: "active" | "inactive";
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          phone?: string | null;
          daily_wage_minor?: number;
          status?: "active" | "inactive";
          created_by: string;
        },
        {
          name?: string;
          phone?: string | null;
          daily_wage_minor?: number;
          status?: "active" | "inactive";
        }
      >;
      project_work_logs: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          worker_id: string;
          entry_type:
            | "daily_wage"
            | "bonus"
            | "deduction"
            | "withdrawal"
            | "adjustment";
          work_date: string;
          amount_minor: number;
          currency_code: string;
          note: string | null;
          financial_event_id: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
          updated_at: string;
        },
        never,
        never
      >;
      project_capital_entries: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          entry_type: Database["public"]["Enums"]["project_capital_entry_type"];
          amount_minor: number;
          currency_code: string;
          note: string | null;
          occurred_on: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          entry_type: Database["public"]["Enums"]["project_capital_entry_type"];
          amount_minor: number;
          currency_code: string;
          note?: string | null;
          occurred_on?: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          entry_type?: Database["public"]["Enums"]["project_capital_entry_type"];
          amount_minor?: number;
          currency_code?: string;
          note?: string | null;
          occurred_on?: string;
          created_by?: string;
          client_id?: string;
          operation?: string;
          payload_hash?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      project_inventory_items: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          quantity: number;
          unit_label: string;
          unit_cost_minor: number | null;
          currency_code: string;
          status: Database["public"]["Enums"]["project_inventory_item_status"];
          barcode: string | null;
          location_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          quantity?: number;
          unit_label: string;
          unit_cost_minor?: number | null;
          currency_code: string;
          status?: Database["public"]["Enums"]["project_inventory_item_status"];
          barcode?: string | null;
          location_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          name?: string;
          quantity?: number;
          unit_label?: string;
          unit_cost_minor?: number | null;
          currency_code?: string;
          status?: Database["public"]["Enums"]["project_inventory_item_status"];
          barcode?: string | null;
          location_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      project_inventory_locations: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
        }
      >;
      project_inventory_movements: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          item_id: string;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity: number;
          from_location_id: string | null;
          to_location_id: string | null;
          note: string | null;
          occurred_on: string;
          created_by: string;
          client_id: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          item_id: string;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity: number;
          from_location_id?: string | null;
          to_location_id?: string | null;
          note?: string | null;
          occurred_on?: string;
          created_by: string;
          client_id: string;
          created_at?: string;
        },
        {
          note?: string | null;
        }
      >;
      livestock_batches: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          species: string | null;
          head_count: number;
          note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          species?: string | null;
          head_count?: number;
          note?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          species?: string | null;
          head_count?: number;
          note?: string | null;
        }
      >;
      livestock_events: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          batch_id: string;
          event_type: Database["public"]["Enums"]["livestock_event_type"];
          quantity: number;
          occurred_on: string;
          note: string | null;
          created_by: string;
          client_id: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          batch_id: string;
          event_type: Database["public"]["Enums"]["livestock_event_type"];
          quantity: number;
          occurred_on?: string;
          note?: string | null;
          created_by: string;
          client_id: string;
          created_at?: string;
        },
        {
          note?: string | null;
        }
      >;
      financial_event_attachments: Table<
        {
          id: string;
          workspace_id: string;
          financial_event_id: string;
          object_path: string;
          file_name: string;
          content_type: string;
          byte_size: number;
          created_by: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          financial_event_id: string;
          object_path: string;
          file_name: string;
          content_type: string;
          byte_size: number;
          created_by: string;
          created_at?: string;
        },
        Record<string, never>
      >;
      workspace_goals: Table<
        {
          workspace_id: string;
          month_key: string;
          income_goal_minor: number;
          currency_code: string;
          note: string | null;
          updated_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          workspace_id: string;
          month_key: string;
          income_goal_minor: number;
          currency_code: string;
          note?: string | null;
          updated_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          income_goal_minor?: number;
          currency_code?: string;
          note?: string | null;
          updated_by?: string;
        }
      >;
      workspace_invites: Table<
        {
          id: string;
          workspace_id: string;
          email: string;
          role: Database["public"]["Enums"]["workspace_role"];
          token: string;
          invited_by: string;
          accepted_at: string | null;
          accepted_by: string | null;
          expires_at: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          email: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          token: string;
          invited_by: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          expires_at: string;
          created_at?: string;
        },
        {
          accepted_at?: string | null;
          accepted_by?: string | null;
        }
      >;
      project_members: Table<
        {
          workspace_id: string;
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["project_member_role"];
          created_by: string;
          created_at: string;
        },
        {
          workspace_id: string;
          project_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["project_member_role"];
          created_by: string;
          created_at?: string;
        },
        {
          role?: Database["public"]["Enums"]["project_member_role"];
        }
      >;
      workspace_achievement_unlocks: Table<
        {
          workspace_id: string;
          achievement_id: string;
          unlocked_at: string;
          evidence: Json;
        },
        {
          workspace_id: string;
          achievement_id: string;
          unlocked_at?: string;
          evidence?: Json;
        },
        {
          evidence?: Json;
        }
      >;
      project_achievement_unlocks: Table<
        {
          workspace_id: string;
          project_id: string;
          achievement_id: string;
          unlocked_at: string;
          evidence: Json;
        },
        {
          workspace_id: string;
          project_id: string;
          achievement_id: string;
          unlocked_at?: string;
          evidence?: Json;
        },
        {
          evidence?: Json;
        }
      >;
      categories: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          kind: Database["public"]["Enums"]["category_kind"];
          is_system: boolean;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          kind: Database["public"]["Enums"]["category_kind"];
          is_system?: boolean;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          is_active?: boolean;
        }
      >;
      budgets: Table<
        {
          id: string;
          workspace_id: string;
          category_id: string;
          currency_code: string;
          limit_minor: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          category_id: string;
          currency_code: string;
          limit_minor: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          limit_minor?: number;
        }
      >;
      recurring_transactions: Table<
        {
          id: string;
          workspace_id: string;
          title: string;
          kind: Database["public"]["Enums"]["transaction_kind"];
          amount_minor: number;
          currency_code: string;
          wallet_id: string;
          category_id: string | null;
          project_id: string | null;
          frequency: Database["public"]["Enums"]["recurring_frequency"];
          interval_steps: number;
          next_date: string;
          last_posted_at: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          title: string;
          kind: Database["public"]["Enums"]["transaction_kind"];
          amount_minor: number;
          currency_code: string;
          wallet_id: string;
          category_id?: string | null;
          project_id?: string | null;
          frequency?: Database["public"]["Enums"]["recurring_frequency"];
          interval_steps?: number;
          next_date: string;
          last_posted_at?: string | null;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          title?: string;
          amount_minor?: number;
          currency_code?: string;
          wallet_id?: string;
          category_id?: string | null;
          project_id?: string | null;
          frequency?: Database["public"]["Enums"]["recurring_frequency"];
          interval_steps?: number;
          next_date?: string;
          is_active?: boolean;
        }
      >;
      ledger_accounts: Table<
        {
          id: string;
          workspace_id: string;
          currency_code: string;
          account_type: Database["public"]["Enums"]["ledger_account_type"];
          system_key:
            | Database["public"]["Enums"]["ledger_system_key"]
            | null;
          name: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          currency_code: string;
          account_type: Database["public"]["Enums"]["ledger_account_type"];
          system_key?:
            | Database["public"]["Enums"]["ledger_system_key"]
            | null;
          name: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          is_active?: boolean;
        }
      >;
      wallets: Table<
        {
          id: string;
          workspace_id: string;
          ledger_account_id: string;
          currency_code: string;
          asset_account_type: "asset";
          name: string;
          status: Database["public"]["Enums"]["wallet_status"];
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          ledger_account_id: string;
          currency_code: string;
          asset_account_type?: never;
          name: string;
          status?: Database["public"]["Enums"]["wallet_status"];
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          status?: Database["public"]["Enums"]["wallet_status"];
        }
      >;
      financial_events: Table<
        {
          id: string;
          workspace_id: string;
          event_type: Database["public"]["Enums"]["financial_event_type"];
          currency_code: string;
          occurred_at: string;
          description: string | null;
          category_id: string | null;
          project_id: string | null;
          reversal_of_event_id: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          event_type: Database["public"]["Enums"]["financial_event_type"];
          currency_code: string;
          occurred_at: string;
          description?: string | null;
          category_id?: string | null;
          project_id?: string | null;
          reversal_of_event_id?: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at?: string;
          updated_at?: string;
        },
        never
      >;
      ledger_entries: Table<
        {
          id: string;
          workspace_id: string;
          event_id: string;
          account_id: string;
          currency_code: string;
          line_no: number;
          amount_minor: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          event_id: string;
          account_id: string;
          currency_code: string;
          line_no: number;
          amount_minor: number;
          created_at?: string;
          updated_at?: string;
        },
        never
      >;
      debt_parties: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          phone?: string | null;
          notes?: string | null;
        }
      >;
      debts: Table<
        {
          id: string;
          workspace_id: string;
          party_id: string;
          direction: Database["public"]["Enums"]["debt_direction"];
          principal_minor: number;
          currency_code: string;
          status: Database["public"]["Enums"]["debt_status"];
          due_on: string | null;
          project_id: string | null;
          note: string | null;
          archived_at: string | null;
          created_by: string;
          client_id: string;
          payload_hash: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          party_id: string;
          direction: Database["public"]["Enums"]["debt_direction"];
          principal_minor: number;
          currency_code: string;
          status?: Database["public"]["Enums"]["debt_status"];
          due_on?: string | null;
          project_id?: string | null;
          note?: string | null;
          archived_at?: string | null;
          created_by: string;
          client_id: string;
          payload_hash: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: Database["public"]["Enums"]["debt_status"];
          due_on?: string | null;
          note?: string | null;
          archived_at?: string | null;
        }
      >;
      debt_entries: Table<
        {
          id: string;
          workspace_id: string;
          debt_id: string;
          entry_type: Database["public"]["Enums"]["debt_entry_type"];
          amount_minor: number;
          currency_code: string;
          occurred_on: string;
          note: string | null;
          financial_event_id: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          debt_id: string;
          entry_type: Database["public"]["Enums"]["debt_entry_type"];
          amount_minor: number;
          currency_code: string;
          occurred_on: string;
          note?: string | null;
          financial_event_id?: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at?: string;
        },
        never
      >;
      clients: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          phone?: string | null;
          notes?: string | null;
        }
      >;
      invoices: Table<
        {
          id: string;
          workspace_id: string;
          invoice_number: string;
          business_client_id: string | null;
          client_name: string;
          client_phone: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          issue_on: string;
          due_on: string | null;
          notes: string | null;
          tax_rate_percent: number;
          subtotal_minor: number;
          tax_minor: number;
          total_minor: number;
          paid_minor: number;
          currency_code: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          invoice_number: string;
          business_client_id?: string | null;
          client_name: string;
          client_phone?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          issue_on?: string;
          due_on?: string | null;
          notes?: string | null;
          tax_rate_percent?: number;
          subtotal_minor?: number;
          tax_minor?: number;
          total_minor?: number;
          paid_minor?: number;
          currency_code: string;
          created_by: string;
          client_id: string;
          operation?: string;
          payload_hash: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          invoice_number?: string;
          business_client_id?: string | null;
          client_name?: string;
          client_phone?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          issue_on?: string;
          due_on?: string | null;
          notes?: string | null;
          tax_rate_percent?: number;
          subtotal_minor?: number;
          tax_minor?: number;
          total_minor?: number;
          paid_minor?: number;
          updated_at?: string;
        }
      >;
      invoice_items: Table<
        {
          id: string;
          workspace_id: string;
          invoice_id: string;
          sort_order: number;
          description: string;
          quantity: number;
          unit_price_minor: number;
          line_total_minor: number;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          invoice_id: string;
          sort_order?: number;
          description: string;
          quantity: number;
          unit_price_minor: number;
          line_total_minor: number;
          created_at?: string;
        },
        {
          sort_order?: number;
          description?: string;
          quantity?: number;
          unit_price_minor?: number;
          line_total_minor?: number;
        }
      >;
      invoice_payments: Table<
        {
          id: string;
          workspace_id: string;
          invoice_id: string;
          amount_minor: number;
          method: string;
          notes: string | null;
          wallet_id: string | null;
          financial_event_id: string | null;
          paid_on: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          invoice_id: string;
          amount_minor: number;
          method?: string;
          notes?: string | null;
          wallet_id?: string | null;
          financial_event_id?: string | null;
          paid_on?: string;
          created_by: string;
          client_id: string;
          operation?: string;
          payload_hash: string;
          created_at?: string;
        },
        {
          amount_minor?: number;
          method?: string;
          notes?: string | null;
          wallet_id?: string | null;
          financial_event_id?: string | null;
          paid_on?: string;
        }
      >;
      project_cash_entries: Table<
        {
          id: string;
          workspace_id: string;
          project_id: string;
          entry_type: Database["public"]["Enums"]["project_cash_entry_type"];
          amount_minor: number;
          currency_code: string;
          title: string;
          note: string | null;
          category_id: string | null;
          business_client_id: string | null;
          wallet_id: string | null;
          financial_event_id: string | null;
          occurred_on: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          project_id: string;
          entry_type: Database["public"]["Enums"]["project_cash_entry_type"];
          amount_minor: number;
          currency_code: string;
          title: string;
          note?: string | null;
          category_id?: string | null;
          business_client_id?: string | null;
          wallet_id?: string | null;
          financial_event_id?: string | null;
          occurred_on: string;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at?: string;
        },
        never
      >;
      income_sources: Table<
        {
          id: string;
          workspace_id: string;
          name: string;
          place_label: string | null;
          pay_kind: Database["public"]["Enums"]["income_pay_kind"];
          default_daily_wage_minor: number;
          monthly_salary_minor: number;
          currency_code: string;
          status: string;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          name: string;
          place_label?: string | null;
          pay_kind?: Database["public"]["Enums"]["income_pay_kind"];
          default_daily_wage_minor?: number;
          monthly_salary_minor?: number;
          currency_code: string;
          status?: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          place_label?: string | null;
          pay_kind?: Database["public"]["Enums"]["income_pay_kind"];
          default_daily_wage_minor?: number;
          monthly_salary_minor?: number;
          status?: string;
          notes?: string | null;
        }
      >;
      income_entries: Table<
        {
          id: string;
          workspace_id: string;
          source_id: string;
          entry_type: Database["public"]["Enums"]["income_entry_type"];
          amount_minor: number;
          currency_code: string;
          work_on: string | null;
          period_key: string | null;
          reason: string | null;
          note: string | null;
          wallet_id: string | null;
          financial_event_id: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at: string;
        },
        {
          id?: string;
          workspace_id: string;
          source_id: string;
          entry_type: Database["public"]["Enums"]["income_entry_type"];
          amount_minor: number;
          currency_code: string;
          work_on?: string | null;
          period_key?: string | null;
          reason?: string | null;
          note?: string | null;
          wallet_id?: string | null;
          financial_event_id?: string | null;
          created_by: string;
          client_id: string;
          operation: string;
          payload_hash: string;
          created_at?: string;
        },
        never
      >;
    };
    Views: {
      wallet_balances: View<{
        id: string;
        workspace_id: string;
        name: string;
        currency_code: string;
        status: Database["public"]["Enums"]["wallet_status"];
        balance_minor: string;
        created_at: string;
        updated_at: string;
      }>;
      financial_event_details: View<{
        id: string;
        workspace_id: string;
        event_type: Database["public"]["Enums"]["financial_event_type"];
        effective_event_type: Database["public"]["Enums"]["financial_event_type"];
        is_reversal: boolean;
        currency_code: string;
        occurred_at: string;
        description: string | null;
        category_id: string | null;
        project_id: string | null;
        reversal_of_event_id: string | null;
        created_by: string;
        source_wallet_id: string | null;
        destination_wallet_id: string | null;
        amount_minor: string;
        created_at: string;
      }>;
      visible_financial_events: View<{
        id: string;
        workspace_id: string;
        event_type: Database["public"]["Enums"]["financial_event_type"];
        currency_code: string;
        occurred_at: string;
        description: string | null;
        category_id: string | null;
        project_id: string | null;
        reversal_of_event_id: string | null;
        created_by: string;
        source_wallet_id: string | null;
        destination_wallet_id: string | null;
        amount_minor: string;
        created_at: string;
      }>;
      project_totals: View<{
        project_id: string;
        workspace_id: string;
        currency_code: string;
        income_minor: string;
        expense_minor: string;
        net_minor: string;
      }>;
      project_summaries: View<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        goal_minor: string | null;
        color_token: string;
        status: Database["public"]["Enums"]["project_status"];
        project_type: string;
        modules: Json;
        parent_project_id: string | null;
        cash_mode: Database["public"]["Enums"]["project_cash_mode"];
        linked_wallet_id: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>;
      project_cash_balances: View<{
        workspace_id: string | null;
        project_id: string | null;
        cash_mode: Database["public"]["Enums"]["project_cash_mode"] | null;
        linked_wallet_id: string | null;
        balance_minor: number | null;
        currency_code: string | null;
      }>;
      income_source_balances: View<{
        workspace_id: string | null;
        source_id: string | null;
        name: string | null;
        pay_kind: Database["public"]["Enums"]["income_pay_kind"] | null;
        status: string | null;
        currency_code: string | null;
        outstanding_minor: number | null;
        earned_daily_minor: number | null;
        earned_salary_minor: number | null;
        bonus_minor: number | null;
        deduction_minor: number | null;
        withdrawn_minor: number | null;
        daily_count: number | null;
      }>;
      project_financial_totals: View<{
        project_id: string;
        workspace_id: string;
        currency_code: string;
        income_minor: string;
        expense_minor: string;
        net_minor: string;
      }>;
      project_capital_totals: View<{
        workspace_id: string;
        project_id: string;
        currency_code: string;
        opening_minor: string;
        contributions_minor: string;
        withdrawals_minor: string;
        adjustments_minor: string;
        net_capital_minor: string;
      }>;
      project_inventory_totals: View<{
        workspace_id: string;
        project_id: string;
        currency_code: string;
        item_count: number;
        inventory_value_minor: string;
      }>;
      project_capital_entry_details: View<{
        id: string;
        workspace_id: string;
        project_id: string;
        entry_type: Database["public"]["Enums"]["project_capital_entry_type"];
        amount_minor: string;
        currency_code: string;
        note: string | null;
        occurred_on: string;
        created_by: string;
        client_id: string;
        operation: string;
        payload_hash: string;
        created_at: string;
        updated_at: string;
      }>;
      project_inventory_item_details: View<{
        id: string;
        workspace_id: string;
        project_id: string;
        name: string;
        quantity: number;
        unit_label: string;
        unit_cost_minor: string | null;
        currency_code: string;
        status: Database["public"]["Enums"]["project_inventory_item_status"];
        barcode: string | null;
        location_id: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>;
      project_worker_balances: View<{
        worker_id: string;
        workspace_id: string;
        project_id: string;
        name: string;
        phone: string | null;
        daily_wage_minor: number;
        status: "active" | "inactive";
        balance_minor: string;
        earned_minor: string;
        withdrawn_minor: string;
        deducted_minor: string;
        work_days: number;
      }>;
      project_worker_balance_details: View<{
        worker_id: string;
        workspace_id: string;
        project_id: string;
        name: string;
        phone: string | null;
        daily_wage_minor: string;
        status: "active" | "inactive";
        balance_minor: string;
        earned_minor: string;
        withdrawn_minor: string;
        deducted_minor: string;
        work_days: number;
      }>;
      project_work_log_details: View<{
        id: string;
        workspace_id: string;
        project_id: string;
        worker_id: string;
        entry_type:
          | "daily_wage"
          | "bonus"
          | "deduction"
          | "withdrawal"
          | "adjustment";
        work_date: string;
        amount_minor: string;
        currency_code: string;
        note: string | null;
        financial_event_id: string | null;
        created_by: string;
        client_id: string;
        operation: string;
        payload_hash: string;
        created_at: string;
        updated_at: string;
      }>;
      project_labor_totals: View<{
        project_id: string;
        workspace_id: string;
        outstanding_minor: string;
        earned_minor: string;
        withdrawn_minor: string;
        deducted_minor: string;
        active_workers: number;
      }>;
      project_labor_summaries: View<{
        project_id: string;
        workspace_id: string;
        outstanding_minor: string;
        earned_minor: string;
        withdrawn_minor: string;
        deducted_minor: string;
        active_workers: number;
      }>;
      supervisor_workspace_overview: View<{
        workspace_id: string;
        workspace_name: string;
        default_currency_code: string;
        workspace_status: string;
        workspace_created_at: string;
        owner_user_id: string | null;
        owner_display_name: string | null;
        owner_account_status: string | null;
        subscription_id: string | null;
        subscription_status: string | null;
        trial_ends_at: string | null;
        current_period_ends_at: string | null;
        frozen_at: string | null;
        plan_code: string | null;
        plan_name: string | null;
        pending_payments: number;
      }>;
      supervisor_platform_stats: View<{
        total_workspaces: number;
        total_users: number;
        trialing_count: number;
        active_count: number;
        frozen_count: number;
        churned_count: number;
        pending_payments: number;
        pending_amount_minor: string;
        suspended_users: number;
      }>;
      supervisor_user_directory: View<{
        user_id: string;
        display_name: string | null;
        account_status: string;
        system_role: string;
        created_at: string;
        workspace_id: string | null;
        workspace_name: string | null;
        subscription_status: string | null;
        trial_ends_at: string | null;
      }>;
      debt_balances: View<{
        id: string;
        workspace_id: string;
        party_id: string;
        party_name: string;
        party_phone: string | null;
        direction: Database["public"]["Enums"]["debt_direction"];
        principal_minor: string;
        balance_minor: string;
        paid_minor: string;
        adjusted_minor: string;
        written_off_minor: string;
        currency_code: string;
        status: Database["public"]["Enums"]["debt_status"];
        due_on: string | null;
        project_id: string | null;
        project_name: string | null;
        note: string | null;
        archived_at: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>;
      debt_entry_details: View<{
        id: string;
        workspace_id: string;
        debt_id: string;
        entry_type: Database["public"]["Enums"]["debt_entry_type"];
        amount_minor: string;
        currency_code: string;
        occurred_on: string;
        note: string | null;
        financial_event_id: string | null;
        created_by: string;
        client_id: string;
        operation: string;
        created_at: string;
      }>;
      debt_summaries: View<{
        workspace_id: string;
        currency_code: string;
        receivable_minor: string;
        payable_minor: string;
        net_minor: string;
        open_count: number;
        overdue_count: number;
        due_soon_count: number;
      }>;
    };
    Functions: {
      attach_payment_proof: {
        Args: {
          p_payment_request_id: string;
          p_object_path: string;
        };
        Returns: string;
      };
      create_payment_request: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_plan_id: string;
          p_period_count?: number;
          p_requester_note?: string | null;
        };
        Returns: string;
      };
      create_wallet: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_name: string;
          p_currency_code: string;
          p_opening_balance_minor?: number;
        };
        Returns: string;
      };
      create_project:
        | {
            Args: {
              p_workspace_id: string;
              p_name: string;
              p_description?: string | null;
              p_goal_minor?: number | null;
              p_color_token?: string;
              p_status?: Database["public"]["Enums"]["project_status"];
              p_client_id?: string;
            };
            Returns: Database["public"]["Tables"]["projects"]["Row"];
          }
        | {
            Args: {
              p_workspace_id: string;
              p_name: string;
              p_project_type: string;
              p_modules: Json;
              p_description?: string | null;
              p_goal_minor?: number | null;
              p_color_token?: string;
              p_status?: Database["public"]["Enums"]["project_status"];
              p_client_id?: string;
              p_opening_capital_minor?: number | null;
              p_seed_categories?: Json;
            };
            Returns: Database["public"]["Tables"]["projects"]["Row"];
          };
      update_project:
        | {
            Args: {
              p_workspace_id: string;
              p_project_id: string;
              p_name?: string | null;
              p_description?: string | null;
              p_goal_minor?: number | null;
              p_color_token?: string | null;
              p_status?: Database["public"]["Enums"]["project_status"] | null;
            };
            Returns: Database["public"]["Tables"]["projects"]["Row"];
          }
        | {
            Args: {
              p_workspace_id: string;
              p_project_id: string;
              p_project_type: string;
              p_modules: Json;
              p_name?: string | null;
              p_description?: string | null;
              p_goal_minor?: number | null;
              p_color_token?: string | null;
              p_status?: Database["public"]["Enums"]["project_status"] | null;
              p_clear_goal?: boolean;
            };
            Returns: Database["public"]["Tables"]["projects"]["Row"];
          };
      create_project_worker: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_name: string;
          p_daily_wage_minor: number;
          p_phone?: string | null;
        };
        Returns: Database["public"]["Tables"]["project_workers"]["Row"];
      };
      update_project_worker: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_worker_id: string;
          p_name?: string | null;
          p_phone?: string | null;
          p_daily_wage_minor?: number | null;
          p_status?: Database["public"]["Enums"]["worker_status"] | null;
          p_clear_phone?: boolean;
        };
        Returns: Database["public"]["Tables"]["project_workers"]["Row"];
      };
      upsert_category: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_kind: Database["public"]["Enums"]["category_kind"];
          p_category_id?: string | null;
          p_is_active?: boolean;
        };
        Returns: Database["public"]["Tables"]["categories"]["Row"];
      };
      upsert_budget: {
        Args: {
          p_workspace_id: string;
          p_category_id: string;
          p_currency_code: string;
          p_limit_minor: number;
          p_budget_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["budgets"]["Row"];
      };
      delete_budget: {
        Args: {
          p_workspace_id: string;
          p_budget_id: string;
        };
        Returns: undefined;
      };
      upsert_recurring: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_kind: Database["public"]["Enums"]["transaction_kind"];
          p_amount_minor: number;
          p_currency_code: string;
          p_wallet_id: string;
          p_next_date: string;
          p_recurring_id?: string | null;
          p_category_id?: string | null;
          p_project_id?: string | null;
          p_frequency?: Database["public"]["Enums"]["recurring_frequency"];
          p_interval_steps?: number;
          p_is_active?: boolean;
        };
        Returns: Database["public"]["Tables"]["recurring_transactions"]["Row"];
      };
      delete_recurring: {
        Args: {
          p_workspace_id: string;
          p_recurring_id: string;
        };
        Returns: undefined;
      };
      post_all_recurring_due: {
        Args: {
          p_workspace_id: string;
          p_now?: string;
        };
        Returns: number;
      };
      record_daily_work: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_worker_id: string;
          p_work_date: string;
          p_amount_minor?: number | null;
          p_note?: string | null;
          p_client_id?: string;
        };
        Returns: Database["public"]["Tables"]["project_work_logs"]["Row"];
      };
      post_wage_movement: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_worker_id: string;
          p_entry_type:
            | "bonus"
            | "deduction"
            | "withdrawal"
            | "adjustment";
          p_amount_minor: number;
          p_work_date?: string;
          p_wallet_id?: string | null;
          p_note?: string | null;
          p_client_id?: string;
        };
        Returns: Database["public"]["Tables"]["project_work_logs"]["Row"];
      };
      post_capital_entry: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_entry_type: Database["public"]["Enums"]["project_capital_entry_type"];
          p_amount_minor: number;
          p_currency_code?: string | null;
          p_note?: string | null;
          p_occurred_on?: string;
          p_client_id?: string;
        };
        Returns: Database["public"]["Tables"]["project_capital_entries"]["Row"];
      };
      upsert_inventory_item:
        | {
            Args: {
              p_workspace_id: string;
              p_project_id: string;
              p_name: string;
              p_quantity: number;
              p_unit_label: string;
              p_currency_code: string;
              p_unit_cost_minor?: number | null;
              p_item_id?: string | null;
              p_barcode?: string | null;
              p_location_id?: string | null;
            };
            Returns: Database["public"]["Tables"]["project_inventory_items"]["Row"];
          }
        | {
            Args: {
              p_workspace_id: string;
              p_project_id: string;
              p_name: string;
              p_quantity: number;
              p_unit_label: string;
              p_unit_cost_minor?: number | null;
              p_item_id?: string | null;
            };
            Returns: Database["public"]["Tables"]["project_inventory_items"]["Row"];
          };
      archive_inventory_item: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_item_id: string;
        };
        Returns: Database["public"]["Tables"]["project_inventory_items"]["Row"];
      };
      supervisor_freeze_workspace: {
        Args: {
          p_workspace_id: string;
          p_note?: string | null;
        };
        Returns: unknown;
      };
      supervisor_unfreeze_workspace: {
        Args: {
          p_workspace_id: string;
          p_note?: string | null;
        };
        Returns: unknown;
      };
      supervisor_extend_trial: {
        Args: {
          p_workspace_id: string;
          p_extra_days: number;
          p_note?: string | null;
        };
        Returns: unknown;
      };
      supervisor_set_account_status: {
        Args: {
          p_user_id: string;
          p_status: Database["public"]["Enums"]["account_status"];
          p_note?: string | null;
        };
        Returns: unknown;
      };
      complete_required_password_change: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      supervisor_send_notification: {
        Args: {
          p_user_id: string;
          p_workspace_id: string | null;
          p_kind: string;
          p_title: string;
          p_body: string;
          p_metadata: Json;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["notifications"]["Row"];
      };
      supervisor_operational_metrics: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Json;
      };
      supervisor_revenue_series: {
        Args: {
          p_from: string;
          p_to: string;
          p_bucket?: string;
        };
        Returns: {
          bucket_start: string;
          currency_code: string;
          approved_amount_minor: number;
          approved_count: number;
        }[];
      };
      supervisor_plan_mix: {
        Args: Record<string, never>;
        Returns: {
          plan_id: string;
          plan_name: string;
          active_subscriptions: number;
          trialing_subscriptions: number;
          frozen_subscriptions: number;
        }[];
      };
      supervisor_action_queue: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          item_id: string;
          item_type: string;
          severity: string;
          workspace_id: string;
          customer_name: string;
          title: string;
          description: string;
          due_at: string | null;
          action_href: string;
        }[];
      };
      supervisor_send_notification_campaign: {
        Args: {
          p_segment: string;
          p_title: string;
          p_body: string;
          p_note: string;
          p_client_id: string;
        };
        Returns: Json;
      };
      supervisor_list_notification_campaigns: {
        Args: {
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          segment: string;
          title: string;
          body: string;
          recipient_count: number;
          read_count: number;
          actor_name: string | null;
          created_at: string;
        }[];
      };
      supervisor_list_customer_notifications: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_customer_financial_snapshot: {
        Args: {
          p_workspace_id: string;
        };
        Returns: Json;
      };
      supervisor_customer_wallets: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_customer_transactions: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_customer_projects: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_customer_workers: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_list_audit_events: {
        Args: {
          p_query?: string | null;
          p_action_prefix?: string | null;
          p_workspace_id?: string | null;
          p_actor_user_id?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      supervisor_customer_control_ledger: {
        Args: {
          p_workspace_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      supervisor_list_customers: {
        Args: {
          p_query?: string | null;
          p_account_status?: Database["public"]["Enums"]["account_status"] | null;
          p_subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null;
          p_plan_id?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      supervisor_get_customer: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      supervisor_list_plans: {
        Args: {
          p_include_archived?: boolean;
        };
        Returns: Json;
      };
      supervisor_list_payments: {
        Args: {
          p_status?:
            | Database["public"]["Enums"]["payment_request_status"]
            | null;
          p_query?: string | null;
          p_plan_id?: string | null;
          p_currency_code?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      supervisor_create_plan: {
        Args: {
          p_code: string;
          p_name: string;
          p_price_minor: number;
          p_currency_code: string;
          p_billing_interval: Database["public"]["Enums"]["billing_interval"];
          p_interval_count: number | null;
          p_trial_days: number;
          p_is_public: boolean;
          p_features: Json;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["subscription_plans"]["Row"];
      };
      supervisor_update_plan: {
        Args: {
          p_plan_id: string;
          p_name: string;
          p_price_minor: number;
          p_currency_code: string;
          p_billing_interval: Database["public"]["Enums"]["billing_interval"];
          p_interval_count: number | null;
          p_trial_days: number;
          p_is_public: boolean;
          p_features: Json;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["subscription_plans"]["Row"];
      };
      supervisor_archive_plan: {
        Args: {
          p_plan_id: string;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["subscription_plans"]["Row"];
      };
      supervisor_change_subscription_plan: {
        Args: {
          p_workspace_id: string;
          p_plan_id: string;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["workspace_subscriptions"]["Row"];
      };
      supervisor_renew_subscription: {
        Args: {
          p_workspace_id: string;
          p_period_count: number;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["workspace_subscriptions"]["Row"];
      };
      supervisor_set_subscription_state: {
        Args: {
          p_workspace_id: string;
          p_target_status: Database["public"]["Enums"]["subscription_status"];
          p_trial_ends_at: string | null;
          p_current_period_ends_at: string | null;
          p_grace_ends_at: string | null;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["workspace_subscriptions"]["Row"];
      };
      supervisor_schedule_subscription_state: {
        Args: {
          p_workspace_id: string;
          p_target_status: Database["public"]["Enums"]["subscription_status"];
          p_scheduled_at: string;
          p_note: string;
          p_client_id: string;
        };
        Returns: Database["public"]["Tables"]["workspace_subscriptions"]["Row"];
      };
      supervisor_prepare_customer_onboarding: {
        Args: {
          p_email: string;
          p_display_name: string;
          p_workspace_name: string;
          p_currency_code: string;
          p_plan_id: string;
          p_subscription_status: Database["public"]["Enums"]["subscription_status"];
          p_starts_at: string;
          p_trial_ends_at: string | null;
          p_current_period_ends_at: string | null;
          p_must_change_password: boolean;
          p_delivery_mode: string;
          p_note: string;
          p_client_id: string;
        };
        Returns: string;
      };
      supervisor_issue_customer_onboarding_capability: {
        Args: {
          p_intent_id: string;
          p_note: string;
        };
        Returns: string;
      };
      supervisor_cancel_customer_onboarding: {
        Args: {
          p_intent_id: string;
          p_note: string;
        };
        Returns: undefined;
      };
      post_transaction: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_wallet_id: string;
          p_kind: Database["public"]["Enums"]["transaction_kind"];
          p_amount_minor: number;
          p_occurred_at?: string | null;
          p_description?: string | null;
          p_category_id?: string | null;
          p_project_id?: string | null;
          p_business_client_id?: string | null;
        };
        Returns: string;
      };
      upsert_client: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_phone?: string | null;
          p_notes?: string | null;
          p_client_row_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["clients"]["Row"];
      };
      create_income_source: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_pay_kind: Database["public"]["Enums"]["income_pay_kind"];
          p_default_daily_wage_minor?: number;
          p_monthly_salary_minor?: number;
          p_place_label?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["income_sources"]["Row"];
      };
      post_income_entry: {
        Args: {
          p_workspace_id: string;
          p_source_id: string;
          p_client_id: string;
          p_entry_type: Database["public"]["Enums"]["income_entry_type"];
          p_amount_minor: number;
          p_work_on?: string | null;
          p_period_key?: string | null;
          p_reason?: string | null;
          p_note?: string | null;
          p_wallet_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["income_entries"]["Row"];
      };
      post_project_cash_entry: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_client_id: string;
          p_entry_type: Database["public"]["Enums"]["project_cash_entry_type"];
          p_amount_minor: number;
          p_title?: string | null;
          p_note?: string | null;
          p_category_id?: string | null;
          p_business_client_id?: string | null;
          p_occurred_on?: string | null;
        };
        Returns: Database["public"]["Tables"]["project_cash_entries"]["Row"];
      };
      transfer_project_cash_to_wallet: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_client_id: string;
          p_wallet_id: string;
          p_amount_minor: number;
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["project_cash_entries"]["Row"];
      };
      set_project_cash_mode: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_cash_mode: Database["public"]["Enums"]["project_cash_mode"];
        };
        Returns: Database["public"]["Tables"]["projects"]["Row"];
      };
      open_or_link_project_wallet: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_client_id: string;
          p_wallet_id?: string | null;
          p_wallet_name?: string | null;
        };
        Returns: Database["public"]["Tables"]["projects"]["Row"];
      };
      post_transfer: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_source_wallet_id: string;
          p_destination_wallet_id: string;
          p_amount_minor: number;
          p_occurred_at?: string | null;
          p_description?: string | null;
        };
        Returns: string;
      };
      reverse_financial_event: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_event_id: string;
          p_occurred_at?: string | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      adjust_wallet_balance: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_wallet_id: string;
          p_target_balance_minor: number;
          p_note?: string | null;
        };
        Returns: string | null;
      };
      post_treasury_movement: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_wallet_id: string;
          p_amount_minor: number;
          p_direction: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      replace_transaction: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_event_id: string;
          p_wallet_id: string;
          p_kind: Database["public"]["Enums"]["transaction_kind"];
          p_amount_minor: number;
          p_description?: string | null;
          p_category_id?: string | null;
          p_project_id?: string | null;
          p_occurred_at?: string | null;
        };
        Returns: string;
      };
      review_payment_request: {
        Args: {
          p_payment_request_id: string;
          p_decision: Database["public"]["Enums"]["payment_review_decision"];
          p_review_note?: string | null;
        };
        Returns: string;
      };
      create_debt: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_direction: Database["public"]["Enums"]["debt_direction"];
          p_principal_minor: number;
          p_currency_code: string;
          p_party_name: string;
          p_party_phone?: string | null;
          p_party_notes?: string | null;
          p_due_on?: string | null;
          p_project_id?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      post_debt_entry: {
        Args: {
          p_workspace_id: string;
          p_debt_id: string;
          p_entry_type: Exclude<
            Database["public"]["Enums"]["debt_entry_type"],
            "open"
          >;
          p_amount_minor: number;
          p_occurred_on: string;
          p_wallet_id: string | null;
          p_note: string | null;
          p_client_id: string;
        };
        Returns: string;
      };
      update_debt: {
        Args: {
          p_workspace_id: string;
          p_debt_id: string;
          p_party_name?: string | null;
          p_party_phone?: string | null;
          p_due_on?: string | null;
          p_note?: string | null;
          p_clear_due_on?: boolean;
        };
        Returns: Database["public"]["Tables"]["debts"]["Row"];
      };
      archive_debt: {
        Args: {
          p_workspace_id: string;
          p_debt_id: string;
        };
        Returns: Database["public"]["Tables"]["debts"]["Row"];
      };
      rename_wallet: {
        Args: {
          p_workspace_id: string;
          p_wallet_id: string;
          p_name: string;
        };
        Returns: Database["public"]["Tables"]["wallets"]["Row"];
      };
      archive_wallet: {
        Args: {
          p_workspace_id: string;
          p_wallet_id: string;
        };
        Returns: Database["public"]["Tables"]["wallets"]["Row"];
      };
      update_income_source: {
        Args: {
          p_workspace_id: string;
          p_source_id: string;
          p_name?: string | null;
          p_place_label?: string | null;
          p_pay_kind?: Database["public"]["Enums"]["income_pay_kind"] | null;
          p_default_daily_wage_minor?: number | null;
          p_monthly_salary_minor?: number | null;
        };
        Returns: Database["public"]["Tables"]["income_sources"]["Row"];
      };
      archive_income_source: {
        Args: {
          p_workspace_id: string;
          p_source_id: string;
        };
        Returns: Database["public"]["Tables"]["income_sources"]["Row"];
      };
      refresh_operational_notifications: {
        Args: { p_workspace_id: string };
        Returns: number;
      };
      upsert_workspace_goal: {
        Args: {
          p_workspace_id: string;
          p_month_key: string;
          p_income_goal_minor: number;
          p_currency_code: string;
          p_note?: string | null;
          p_client_id?: string | null;
        };
        Returns: Json;
      };
      create_workspace_invite: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role?: Database["public"]["Enums"]["workspace_role"];
          p_client_id?: string | null;
        };
        Returns: Json;
      };
      accept_workspace_invite: {
        Args: {
          p_token: string;
          p_client_id?: string | null;
        };
        Returns: Json;
      };
      attach_financial_event_proof: {
        Args: {
          p_workspace_id: string;
          p_event_id: string;
          p_object_path: string;
          p_file_name: string;
          p_content_type: string;
          p_byte_size: number;
        };
        Returns: Json;
      };
      post_inventory_movement: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_item_id: string;
          p_movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          p_quantity: number;
          p_client_id: string;
          p_from_location_id?: string | null;
          p_to_location_id?: string | null;
          p_note?: string | null;
          p_occurred_on?: string | null;
        };
        Returns: Json;
      };
      create_inventory_location: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_name: string;
        };
        Returns: Json;
      };
      create_livestock_batch: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_name: string;
          p_head_count?: number;
          p_species?: string | null;
          p_note?: string | null;
          p_client_id?: string | null;
        };
        Returns: Json;
      };
      post_livestock_event: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_batch_id: string;
          p_event_type: Database["public"]["Enums"]["livestock_event_type"];
          p_quantity: number;
          p_client_id: string;
          p_note?: string | null;
          p_occurred_on?: string | null;
        };
        Returns: Json;
      };
      unlock_workspace_achievement: {
        Args: {
          p_workspace_id: string;
          p_achievement_id: string;
          p_evidence?: Json;
        };
        Returns: Json;
      };
      unlock_project_achievement: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_achievement_id: string;
          p_evidence?: Json;
        };
        Returns: Json;
      };
      upsert_project_member: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_user_id: string;
          p_role: Database["public"]["Enums"]["project_member_role"];
        };
        Returns: Json;
      };
      next_invoice_number: {
        Args: {
          p_workspace_id: string;
        };
        Returns: string;
      };
      create_invoice: {
        Args: {
          p_workspace_id: string;
          p_client_id: string;
          p_items: Json;
          p_business_client_id?: string | null;
          p_client_name?: string | null;
          p_client_phone?: string | null;
          p_issue_on?: string | null;
          p_due_on?: string | null;
          p_tax_rate_percent?: number;
          p_notes?: string | null;
          p_status?: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: Database["public"]["Tables"]["invoices"]["Row"];
      };
      set_invoice_status: {
        Args: {
          p_workspace_id: string;
          p_invoice_id: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: Database["public"]["Tables"]["invoices"]["Row"];
      };
      update_invoice: {
        Args: {
          p_workspace_id: string;
          p_invoice_id: string;
          p_client_id: string;
          p_items: Json;
          p_business_client_id?: string | null;
          p_client_name?: string | null;
          p_client_phone?: string | null;
          p_issue_on?: string | null;
          p_due_on?: string | null;
          p_tax_rate_percent?: number | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["invoices"]["Row"];
      };
      record_invoice_payment: {
        Args: {
          p_workspace_id: string;
          p_invoice_id: string;
          p_client_id: string;
          p_amount_minor: number;
          p_wallet_id: string;
          p_method?: string;
          p_notes?: string | null;
          p_paid_on?: string | null;
          p_category_id?: string | null;
          p_project_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["invoice_payments"]["Row"];
      };
      update_workspace_branding: {
        Args: {
          p_workspace_id: string;
          p_name?: string | null;
          p_legal_name?: string | null;
          p_phone?: string | null;
          p_address?: string | null;
          p_tax_id?: string | null;
          p_invoice_footer?: string | null;
          p_logo_path?: string | null;
          p_clear_logo?: boolean;
        };
        Returns: Database["public"]["Tables"]["workspaces"]["Row"];
      };
      refresh_overdue_invoices: {
        Args: {
          p_workspace_id: string;
        };
        Returns: number;
      };
    };
    Enums: {
      account_status: "active" | "suspended" | "disabled";
      billing_interval: "none" | "monthly" | "yearly";
      category_kind: "income" | "expense";
      recurring_frequency: "daily" | "weekly" | "monthly" | "yearly";
      debt_direction: "receivable" | "payable";
      debt_entry_type: "open" | "payment" | "adjustment" | "write_off";
      debt_status: "open" | "partial" | "settled" | "written_off";
      invoice_status:
        | "estimate"
        | "draft"
        | "sent"
        | "paid"
        | "partially_paid"
        | "overdue"
        | "cancelled";
      financial_event_type:
        | "income"
        | "expense"
        | "transfer"
        | "opening_balance"
        | "reversal";
      inventory_movement_type: "in" | "out" | "adjust" | "transfer";
      livestock_event_type: "hatch" | "birth" | "death" | "sale" | "transfer";
      ledger_account_type:
        | "asset"
        | "liability"
        | "income"
        | "expense"
        | "equity";
      ledger_system_key: "income" | "expense" | "opening_equity";
      notification_kind:
        | "billing"
        | "payment"
        | "workspace"
        | "system"
        | "operational";
      payment_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled";
      payment_review_decision: "approve" | "reject";
      project_capital_entry_type:
        | "opening"
        | "contribution"
        | "withdrawal"
        | "adjustment";
      project_inventory_item_status: "active" | "archived";
      project_member_role: "manager" | "contributor" | "viewer";
      project_cash_mode: "off" | "project_cash" | "project_wallet" | "hybrid";
      project_cash_entry_type: "income" | "expense" | "transfer_out" | "transfer_in";
      income_pay_kind: "daily" | "monthly" | "both";
      income_entry_type:
        | "daily_wage"
        | "bonus"
        | "deduction"
        | "salary_accrual"
        | "withdrawal";
      project_status: "active" | "archived";
      subscription_status:
        | "trialing"
        | "active"
        | "grace"
        | "frozen"
        | "expired"
        | "cancelled";
      system_role: "user" | "supervisor";
      transaction_kind: "income" | "expense";
      wallet_status: "active" | "inactive" | "archived";
      worker_status: "active" | "inactive";
      workspace_member_status: "active" | "inactive";
      workspace_role: "owner" | "admin" | "member" | "viewer";
      workspace_status: "active" | "suspended" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Insert"];

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Update"];

export type Enums<
  EnumName extends keyof PublicSchema["Enums"],
> = PublicSchema["Enums"][EnumName];
