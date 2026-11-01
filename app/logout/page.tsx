import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LogoutPage() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
