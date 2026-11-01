import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const tableDefinition = (name: string) => {
  const start = schema.indexOf(`create table if not exists public.${name} (`);
  const end = schema.indexOf("\n);", start);
  return start < 0 || end < 0 ? "" : schema.slice(start, end);
};

describe("tenant-owned schema relationships", () => {
  it("stores each extraction job's destination list", () => {
    expect(tableDefinition("extraction_jobs")).toContain(
      "list_id uuid references public.lead_lists(id) on delete set null"
    );
  });

  it("gives replies a user id and constrains access through that owner", () => {
    expect(tableDefinition("replies")).toContain(
      "user_id uuid not null references public.profiles(id) on delete cascade"
    );
    expect(schema).toContain(
      'create policy "Users can manage own replies"\n  on public.replies for all\n  using (auth.uid() = user_id)\n  with check (auth.uid() = user_id);'
    );
  });

  it("backfills ownership for existing replies before requiring it", () => {
    const backfill = schema.indexOf("update public.replies r");
    const requireOwner = schema.indexOf("alter table public.replies alter column user_id set not null");
    expect(backfill).toBeGreaterThan(-1);
    expect(requireOwner).toBeGreaterThan(backfill);
    expect(schema.slice(backfill, requireOwner)).toContain(
      "from public.leads l\nwhere l.id = r.lead_id and r.user_id is null"
    );
  });
});
