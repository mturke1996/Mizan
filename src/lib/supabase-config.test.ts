import { readSupabaseConfig } from "./supabase-config";

describe("readSupabaseConfig", () => {
  it("returns the Vite Supabase environment values", () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("accepts NEXT_PUBLIC aliases when Vite keys are absent", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("rejects an incomplete configuration", () => {
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow("إعدادات Supabase غير مكتملة");
  });
});
