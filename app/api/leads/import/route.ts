import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  csv: z.string().min(1, "CSV content is required").max(5_000_000),
  listId: z.string().uuid().nullable().optional(),
  listName: z.string().trim().min(1).max(120).optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimal RFC4180-ish CSV line parser (handles quoted fields and "" escapes). */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

const FIELD_ALIASES: Record<string, string> = {
  email: "email",
  "e-mail": "email",
  "email address": "email",
  name: "person_name",
  "person name": "person_name",
  "full name": "person_name",
  person_name: "person_name",
  company: "company",
  "company name": "company",
  organisation: "company",
  organization: "company",
  phone: "phone",
  mobile: "phone",
  website: "website",
  url: "website",
  country: "country",
  city: "city",
  state: "state",
  niche: "niche",
  category: "niche",
  designation: "designation",
  title: "designation",
  role: "designation",
};

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid import request" },
      { status: 400 }
    );
  }

  const { csv, listName } = parsed.data;
  let listId = parsed.data.listId ?? null;

  if (!listId && listName) {
    const { data: existingList } = await supabase
      .from("lead_lists")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", listName)
      .maybeSingle();

    listId =
      existingList?.id ??
      (
        await supabase
          .from("lead_lists")
          .insert({ user_id: user.id, name: listName })
          .select("id")
          .single()
      ).data?.id ??
      null;
  }

  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSV needs a header row and at least one lead" },
      { status: 400 }
    );
  }

  const header = parseLine(lines[0]).map(
    (cell) => FIELD_ALIASES[cell.toLowerCase().trim()] || cell.toLowerCase().trim()
  );

  if (!header.includes("email")) {
    return NextResponse.json(
      { error: 'CSV needs an "email" column' },
      { status: 400 }
    );
  }

  const rows: Record<string, any>[] = [];
  const seen = new Set<string>();
  let invalid = 0;

  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const record: Record<string, any> = {};
    header.forEach((key, index) => {
      if (cells[index]) record[key] = cells[index];
    });

    const email = String(record.email || "").toLowerCase().trim();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) {
      invalid++;
      continue;
    }
    seen.add(email);

    rows.push({
      user_id: user.id,
      list_id: listId,
      email,
      person_name: record.person_name || null,
      company: record.company || null,
      phone: record.phone || null,
      website: record.website || null,
      country: record.country || null,
      city: record.city || null,
      state: record.state || null,
      niche: record.niche || null,
      designation: record.designation || null,
      source: "csv",
      status: "new",
      email_status: "unverified",
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found. Check the email column.", invalid },
      { status: 400 }
    );
  }

  // Skip addresses that already exist for this user.
  const { data: existing } = await supabase
    .from("leads")
    .select("email")
    .eq("user_id", user.id)
    .in("email", rows.map((row) => row.email));

  const existingEmails = new Set(
    (existing || []).map((row) => String(row.email).toLowerCase())
  );
  const toInsert = rows.filter((row) => !existingEmails.has(row.email));

  let inserted = 0;
  const failed: string[] = [];

  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { data, error } = await supabase.from("leads").insert(chunk).select("id");
    if (error) {
      failed.push(error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return NextResponse.json({
    inserted,
    duplicates: rows.length - toInsert.length,
    invalid,
    failed: failed.slice(0, 3),
    listId,
  });
}
