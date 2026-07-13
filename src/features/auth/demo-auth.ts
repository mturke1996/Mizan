import type { Session, User } from "@supabase/supabase-js";
import type { AuthContextValue, Profile } from "./AuthProvider";

const demoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@mizan.app",
  app_metadata: {},
  user_metadata: { display_name: "محمد المركي" },
  aud: "authenticated",
  created_at: "2026-07-13T00:00:00.000Z",
} as User;

const demoSession = {
  access_token: "demo",
  refresh_token: "demo",
  expires_in: 3600,
  token_type: "bearer",
  user: demoUser,
} as Session;

const demoProfile = {
  id: demoUser.id,
  system_role: "user",
  account_status: "active",
  display_name: "محمد المركي",
  avatar_url: null,
  locale: "ar",
  timezone: "Africa/Tripoli",
  must_change_password: false,
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z",
} as Profile;

export const demoAuthValue: AuthContextValue = {
  session: demoSession,
  user: demoUser,
  profile: demoProfile,
  isLoading: false,
  signIn: async () => undefined,
  signUp: async () => ({ requiresEmailConfirmation: false }),
  requestPasswordReset: async () => undefined,
  updatePassword: async () => undefined,
  signOut: async () => undefined,
  refreshProfile: async () => undefined,
};
