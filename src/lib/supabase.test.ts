import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseClient } from "./supabase";

describe("getSupabaseClient", () => {
  it("exposes the generated database schema through its client type", () => {
    type Client = ReturnType<typeof getSupabaseClient>;

    expectTypeOf<Client>().toEqualTypeOf<SupabaseClient<Database>>();
  });
});
