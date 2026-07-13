import type { Session } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  AuthContext,
  type AuthContextValue,
  type Profile,
} from "./auth-context";

export type { AuthContextValue, Profile } from "./auth-context";

async function loadProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, system_role, account_status, display_name, avatar_url, locale, timezone, must_change_password, created_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function AuthProvider({
  children,
  value,
}: PropsWithChildren<{ value?: AuthContextValue }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(value ? false : true);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    try {
      setProfile(await loadProfile(session.user.id));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (value) return;

    const supabase = getSupabaseClient();
    let isActive = true;

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error;
        if (!isActive) return;

        setSession(data.session);
        if (data.session?.user.id) {
          try {
            setProfile(await loadProfile(data.session.user.id));
          } catch {
            setProfile(null);
          }
        }
      })
      .catch(() => {
        if (isActive) {
          setSession(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user.id) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      void loadProfile(nextSession.user.id)
        .then((nextProfile) => {
          if (isActive) setProfile(nextProfile);
        })
        .catch(() => {
          if (isActive) setProfile(null);
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [value]);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    [],
  );

  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
    }: {
      email: string;
      password: string;
      displayName: string;
    }) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });
      if (error) throw error;
      return { requiresEmailConfirmation: data.session === null };
    },
    [],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const liveValue = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      isLoading,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value ?? liveValue}>
      {children}
    </AuthContext.Provider>
  );
}

