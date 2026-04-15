/**
 * intake-api edge function test — verifies gate enforcement and authority model.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

async function callIntake(body: Record<string, unknown>, authHeader?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };
  if (authHeader) headers["Authorization"] = authHeader;

  const res = await fetch(`${BASE}/functions/v1/intake-api`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

Deno.test("unauthenticated request returns 401", async () => {
  const { status, data } = await callIntake({ action: "application.my_list" });
  assertEquals(status, 401);
  assertEquals(data.error, "unauthorized");
});

Deno.test("submit without auth returns 401", async () => {
  const { status, data } = await callIntake({
    action: "application.submit",
    program_id: "00000000-0000-0000-0000-000000000001",
    university_id: "00000000-0000-0000-0000-000000000002",
    overall_score: 80,
    verdict: "apply_ready",
  });
  assertEquals(status, 401);
  assertEquals(data.error, "unauthorized");
});

Deno.test("list without auth returns 401", async () => {
  const { status, data } = await callIntake({
    action: "application.list",
    university_id: "00000000-0000-0000-0000-000000000001",
  });
  assertEquals(status, 401);
  assertEquals(data.error, "unauthorized");
});

Deno.test("review without auth returns 401", async () => {
  const { status, data } = await callIntake({
    action: "application.review",
    application_id: "00000000-0000-0000-0000-000000000001",
    new_status: "accepted",
  });
  assertEquals(status, 401);
  assertEquals(data.error, "unauthorized");
});
