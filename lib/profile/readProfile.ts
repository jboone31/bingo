import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/** The signed-in user's display name, read through RLS. `null` if none. */
export async function readOwnDisplayName(
  userId: string,
): Promise<string | null> {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return typeof data?.display_name === "string" ? data.display_name : null;
}
