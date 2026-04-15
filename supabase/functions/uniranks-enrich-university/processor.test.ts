import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { persistPrograms, recordRegexNoMatch } from "./processor.ts";

function createMockSupabase(mode: "success" | "conflict") {
  const ingestErrors: Array<Record<string, unknown>> = [];

  return {
    ingestErrors,
    client: {
      from(table: string) {
        if (table === "ingest_errors") {
          return {
            insert(payload: Record<string, unknown>) {
              ingestErrors.push(payload);
              return Promise.resolve({ data: null, error: null });
            },
          };
        }

        if (table === "program_draft") {
          return {
            upsert(_payload: Record<string, unknown>) {
              return {
                select() {
                  if (mode === "success") {
                    return Promise.resolve({ data: [{ id: 101 }], error: null });
                  }
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "23505",
                      message: "duplicate key value violates unique constraint uq_program_draft_content_hash",
                      details: "Key (content_hash) already exists.",
                    },
                  });
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

const baseProgram = {
  name: "BSc Computer Science",
  degree: { raw: "Bachelor", level: "bachelor" },
  evidence: {
    name: "BSc Computer Science",
  },
};

Deno.test("persistPrograms increments programs_saved only on successful upsert", async () => {
  const mock = createMockSupabase("success");

  const result = await persistPrograms({
    supabase: mock.client,
    discovered: [baseProgram as any],
    scrapeMarkdown: "BSc Computer Science",
    sourceUrl: "https://www.uniranks.com/universities/test-u",
    university_id: "00000000-0000-0000-0000-000000000001",
    slug: "test-u",
    contentHash: "hash-success",
    job_id: "00000000-0000-0000-0000-000000000011",
    batch_id: "00000000-0000-0000-0000-000000000021",
  });

  assertEquals(result.programsSaved, 1);
  assertEquals(result.programsRejected, 0);
  assertEquals(mock.ingestErrors.length, 0);
});

Deno.test("persistPrograms logs unique conflicts and does not increment programs_saved", async () => {
  const mock = createMockSupabase("conflict");

  const result = await persistPrograms({
    supabase: mock.client,
    discovered: [baseProgram as any],
    scrapeMarkdown: "BSc Computer Science",
    sourceUrl: "https://www.uniranks.com/universities/test-u",
    university_id: "00000000-0000-0000-0000-000000000001",
    slug: "test-u",
    contentHash: "hash-conflict",
    job_id: "00000000-0000-0000-0000-000000000012",
    batch_id: "00000000-0000-0000-0000-000000000022",
  });

  assertEquals(result.programsSaved, 0);
  assertEquals(result.programsRejected, 1);
  assertEquals(result.rejectionReasons.unique_conflict_content_hash, 1);
  assertEquals(mock.ingestErrors.length, 1);
  assertEquals(mock.ingestErrors[0].reason, "unique_conflict_content_hash");
});

Deno.test("recordRegexNoMatch writes regex_no_match ingest error", async () => {
  const mock = createMockSupabase("success");

  await recordRegexNoMatch({
    supabase: mock.client,
    sourceUrl: "https://www.uniranks.com/universities/test-u",
    contentHash: "hash-no-match",
    mode: "regex",
    job_id: "00000000-0000-0000-0000-000000000013",
    batch_id: "00000000-0000-0000-0000-000000000023",
  });

  assertEquals(mock.ingestErrors.length, 1);
  assertEquals(mock.ingestErrors[0].reason, "regex_no_match");
  assertEquals(mock.ingestErrors[0].stage, "extract");
});
