export interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function readSupabaseConfig(
  environment: SupabaseEnvironment,
): SupabaseConfig {
  const url =
    environment.VITE_SUPABASE_URL?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("إعدادات Supabase غير مكتملة");
  }

  return { url, publishableKey };
}
