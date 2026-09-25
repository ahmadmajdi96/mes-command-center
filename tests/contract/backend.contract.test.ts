/**
 * Backend contract tests — run against the real backend.
 *   bun run test:contract
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (from .env),
 *      MES_TEST_EMAIL / MES_TEST_PASSWORD (a signed-in account; signed-in suites skip without them).
 * Tests never leave data behind: every write attempt is expected to be refused.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith(name + "="));
    return line?.split("=").slice(1).join("=").replace(/^"|"$/g, "");
  } catch { return undefined; }
}
const URL_ = env("VITE_SUPABASE_URL")!;
const KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const EMAIL = env("MES_TEST_EMAIL");
const PASSWORD = env("MES_TEST_PASSWORD");
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const OPERATIONAL = [
  "production_orders", "production_batches", "product_units", "unit_events", "unit_readings",
  "batch_station_progress", "waste_events", "station_holds", "downtime_events", "quality_holds",
  "lines", "stations", "products", "audit_entries", "api_keys",
];
const HISTORY = ["unit_events", "unit_readings", "waste_events", "audit_entries", "batch_station_progress"];

describe("signed-out access", () => {
  const anon = mk();
  it.each(OPERATIONAL)("cannot read %s", async (t) => {
    const { data, error } = await anon.from(t as never).select("*").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it.each(HISTORY)("cannot write %s", async (t) => {
    const { error } = await anon.from(t as never).insert({ id: "contract-test" } as never);
    expect(error).not.toBeNull();
  });
});

describe("lifecycle transitions (database rule)", () => {
  const anon = mk();
  const cases: [string, string, boolean][] = [
    ["scheduled", "released", true],
    ["released", "running", true],
    ["running", "completed", true],
    ["completed", "closed", true],
    ["scheduled", "completed", false],
    ["scheduled", "running", false],
    ["completed", "running", false],
    ["closed", "running", false],
    ["cancelled", "released", false],
  ];
  it.each(cases)("%s → %s allowed=%s", async (from, to, ok) => {
    const { error } = await anon.rpc("assert_status_transition" as never, { _entity: "order", _from: from, _to: to } as never);
    if (ok) expect(error).toBeNull();
    else expect(error?.message ?? "").toMatch(/cannot go from/);
  });
});

const signedIn = EMAIL && PASSWORD ? describe : describe.skip;
signedIn("signed-in contracts", () => {
  let db: SupabaseClient;
  let userId = "";
  let myOrgs: string[] = [];

  beforeAll(async () => {
    db = mk();
    const { data, error } = await db.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
    if (error) throw error;
    userId = data.user.id;
    const { data: orgs } = await db.rpc("user_orgs" as never, { _user_id: userId } as never);
    myOrgs = ((orgs as { organization_id: string }[] | null) ?? []).map((o) => o.organization_id);
  });

  describe("company isolation", () => {
    it.each(OPERATIONAL.filter((t) => t !== "api_keys" && t !== "products"))("%s only returns my companies' rows", async (t) => {
      const { data, error } = await db.from(t as never).select("organization_id").limit(500);
      expect(error).toBeNull();
      const isPlatform = (await db.rpc("is_platform_admin" as never, { _user_id: userId } as never)).data === true;
      if (!isPlatform) for (const r of (data ?? []) as { organization_id: string }[]) expect(myOrgs).toContain(r.organization_id);
    });
    it("in_my_org refuses an unknown company", async () => {
      const { data } = await db.rpc("in_my_org" as never, { _org: "ORG-DOES-NOT-EXIST" } as never);
      expect(data).toBe(false);
    });
  });

  describe("permissions", () => {
    it("has_action returns a boolean and rejects unknown actions", async () => {
      const { data, error } = await db.rpc("has_action" as never, { _user_id: userId, _action: "no.such.action" } as never);
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
    it("roles and permission catalogue cannot be modified", async () => {
      const { error } = await db.from("roles" as never).insert({ key: "contract_test", label: "x" } as never);
      expect(error).not.toBeNull();
    });
  });

  describe("protected history", () => {
    it.each(HISTORY)("%s rows cannot be edited", async (t) => {
      const { data: rows } = await db.from(t as never).select("id").limit(1);
      const id = (rows as { id: string }[] | null)?.[0]?.id;
      if (!id) return; // nothing to test against yet
      const { error, data } = await db.from(t as never).update({ correction_reason: "tamper" } as never).eq("id", id).select();
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
    it.each(HISTORY)("%s rows cannot be deleted", async (t) => {
      const { data: rows } = await db.from(t as never).select("id").limit(1);
      const id = (rows as { id: string }[] | null)?.[0]?.id;
      if (!id) return;
      await db.from(t as never).delete().eq("id", id);
      const { data: still } = await db.from(t as never).select("id").eq("id", id);
      expect((still ?? []).length).toBe(1);
    });
  });

  describe("quantity recording", () => {
    it("lot quantities must point at a real batch", async () => {
      const { error } = await db.from("batch_station_progress" as never).insert({
        organization_id: myOrgs[0] ?? "ORG-01", batch_id: "NO-SUCH-BATCH", qty_in: 1, qty_good: 1,
      } as never);
      expect(error).not.toBeNull();
    });
    it("orders cannot jump straight to completed", async () => {
      const { data: po } = await db.from("production_orders").select("id,status").eq("status", "scheduled").limit(1).maybeSingle();
      if (!po) return;
      const { error } = await db.from("production_orders").update({ status: "completed" }).eq("id", po.id);
      expect(error?.message ?? "").toMatch(/cannot go from/);
    });
  });
});
