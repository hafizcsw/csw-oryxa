// ═══════════════════════════════════════════════════════════════
// Door 2 + Door 3 — Country Eligibility & Measurement Debug Surface
// ═══════════════════════════════════════════════════════════════
// Admin page. Operates on TARGET STUDENT CONTEXT, not current actor.
// Tabs:
//   1) Fixture (proof)         — deterministic engine + measurement-lite
//   2) Target student (smoke)  — admin pastes applicant truth JSON of
//                                a real target student → runs harness
//                                and emits live console artifact.
// Door 3 additions:
//   - measurement-lite snapshot (CLUS, EIUS, LPUS-basic + placeholders)
//   - top blockers / gaps section
//   - countries_in_matrix proves country-pack count at runtime (incl. TR)
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  COUNTRY_PACKS,
  FIXTURE_APPLICANT,
  runHarness,
  type ApplicantTruth,
  type CountryEligibility,
  type CountryStatus,
  type HarnessArtifact,
} from '@/features/target-country';

const STATUS_VARIANT: Record<CountryStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  eligible: 'default',
  conditional: 'secondary',
  blocked: 'destructive',
  unknown: 'outline',
};

function CountryCard({ result }: { result: CountryEligibility }) {
  const pack = COUNTRY_PACKS[result.country_code];
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {pack?.country_name_en ?? result.country_code}{' '}
            <span className="text-muted-foreground text-xs">({result.country_code})</span>
          </CardTitle>
          <Badge variant={STATUS_VARIANT[result.status]} className="uppercase">
            {result.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          confidence {result.confidence} · pack {result.pack_version}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-xs uppercase text-muted-foreground mb-1">Eligible paths</p>
          <div className="flex flex-wrap gap-1">
            {result.eligible_entry_paths.length === 0 ? (
              <span className="text-xs text-muted-foreground">none</span>
            ) : (
              result.eligible_entry_paths.map((p) => (
                <Badge key={p} variant="outline">{p}</Badge>
              ))
            )}
          </div>
        </div>
        {result.blocked_entry_paths.length > 0 && (
          <div>
            <p className="font-medium text-xs uppercase text-muted-foreground mb-1">Blocked paths</p>
            <div className="flex flex-wrap gap-1">
              {result.blocked_entry_paths.map((p) => (
                <Badge key={p} variant="destructive">{p}</Badge>
              ))}
            </div>
          </div>
        )}
        {result.blocking_gaps.length > 0 && (
          <div>
            <p className="font-medium text-xs uppercase text-muted-foreground mb-1">Conditional gaps</p>
            <ul className="space-y-1">
              {result.blocking_gaps.map((r, i) => (
                <li key={i} className="text-xs">
                  <code className="text-warning">{r.reason_code}</code>
                  <span className="text-muted-foreground"> · rule={r.matched_rule_id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.blockers.length > 0 && (
          <div>
            <p className="font-medium text-xs uppercase text-muted-foreground mb-1">Blockers</p>
            <ul className="space-y-1">
              {result.blockers.map((r, i) => (
                <li key={i} className="text-xs">
                  <code className="text-destructive">{r.reason_code}</code>
                  <span className="text-muted-foreground"> · rule={r.matched_rule_id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Separator />
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            evidence ({result.evidence_ids.length}) · matched rules ({result.matched_rule_ids.length})
          </summary>
          <div className="mt-2 space-y-1">
            {result.evidence_ids.map((id) => {
              const ev = pack?.evidence.find((e) => e.evidence_id === id);
              return (
                <div key={id} className="text-[11px]">
                  <code>{id}</code>
                  {ev && (
                    <a href={ev.url} target="_blank" rel="noreferrer" className="text-primary ml-1 underline">
                      {ev.title}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function HarnessView({ artifact, label }: { artifact: HarnessArtifact; label: string }) {
  const { applicant_truth, measurement_snapshot, matrix, top_blockers, countries_in_matrix } = artifact;

  return (
    <div className="space-y-4">
      {/* 1. Normalized applicant truth */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Normalized applicant truth ({label})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/40 p-3 rounded overflow-auto">
            {JSON.stringify(applicant_truth, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* 2. Measurement-lite snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">2. Measurement-lite snapshot</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">tier {measurement_snapshot.overall_profile_tier}</Badge>
              <Badge variant="secondary">conf {measurement_snapshot.confidence_summary}</Badge>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {measurement_snapshot.measurement_version} · trace {measurement_snapshot.computation_trace_id}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border rounded p-2">
              <p className="font-medium uppercase text-muted-foreground mb-1">CLUS</p>
              <pre className="text-[11px]">{JSON.stringify(measurement_snapshot.clus_payload, null, 2)}</pre>
            </div>
            <div className="border rounded p-2">
              <p className="font-medium uppercase text-muted-foreground mb-1">EIUS</p>
              <pre className="text-[11px]">{JSON.stringify(measurement_snapshot.eius_payload, null, 2)}</pre>
            </div>
            <div className="border rounded p-2">
              <p className="font-medium uppercase text-muted-foreground mb-1">LPUS-basic</p>
              <pre className="text-[11px]">{JSON.stringify(measurement_snapshot.lpus_payload, null, 2)}</pre>
            </div>
          </div>
          <details className="text-[11px]">
            <summary className="cursor-pointer text-muted-foreground">
              reserved placeholders (APUS / ISUS / CCUS — non-governing)
            </summary>
            <pre className="mt-1 bg-muted/40 p-2 rounded">
{JSON.stringify({
  apus: measurement_snapshot.apus_payload,
  isus: measurement_snapshot.isus_payload,
  ccus: measurement_snapshot.ccus_payload,
}, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* 3. Top blockers / gaps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">3. Top blockers / gaps ({top_blockers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {top_blockers.length === 0 ? (
            <p className="text-xs text-muted-foreground">no blockers or gaps</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {top_blockers.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge variant={b.severity === 'blocker' ? 'destructive' : 'secondary'}>
                    {b.country_code}
                  </Badge>
                  <code className={b.severity === 'blocker' ? 'text-destructive' : 'text-warning'}>
                    {b.reason_code}
                  </code>
                  <span className="text-muted-foreground">
                    · rule={b.matched_rule_id} · ev=[{b.evidence_ids.join(',')}]
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 4. Country matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            4. Country matrix — {countries_in_matrix.length} packs
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {countries_in_matrix.join(', ')}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-muted-foreground mb-2">
            generated_at {matrix.generated_at}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matrix.results.map((r) => (
              <CountryCard key={r.country_code} result={r} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5. Source/evidence + matched-rule index */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">5. Union of matched rules &amp; evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <details>
            <summary className="text-xs cursor-pointer text-muted-foreground">
              matched_rule_ids ({artifact.matched_rule_ids.length})
            </summary>
            <pre className="text-[11px] bg-muted/40 p-2 rounded mt-1 overflow-auto">
              {artifact.matched_rule_ids.join('\n')}
            </pre>
          </details>
          <details>
            <summary className="text-xs cursor-pointer text-muted-foreground">
              evidence_ids ({artifact.evidence_ids.length})
            </summary>
            <pre className="text-[11px] bg-muted/40 p-2 rounded mt-1 overflow-auto">
              {artifact.evidence_ids.join('\n')}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

const TRUTH_TEMPLATE: ApplicantTruth = {
  student_id: 'paste-real-student-id-here',
  citizenship: 'SA',
  secondary_completed: true,
  secondary_kind: 'general',
  secondary_grade_pct: 82,
  english_test_type: 'ielts',
  english_total_score: 6,
  english_medium_secondary: false,
  majority_english_country: false,
  local_language_signals: [],
};

export default function TargetCountryDebug() {
  // ═══ Door 3 — fixture harness artifact ═══
  const fixtureArtifact = useMemo(
    () => runHarness('fixture', FIXTURE_APPLICANT),
    [],
  );

  // Emit fixture artifact once
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Door3][fixture] harness artifact', fixtureArtifact);
  }, [fixtureArtifact]);

  // ═══ Target student smoke — explicit admin-supplied context ═══
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [truthJsonText, setTruthJsonText] = useState<string>(
    JSON.stringify(TRUTH_TEMPLATE, null, 2),
  );
  const [parsedTruth, setParsedTruth] = useState<ApplicantTruth | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const targetArtifact = useMemo(
    () => (parsedTruth ? runHarness('live_smoke', parsedTruth) : null),
    [parsedTruth],
  );

  function handleRun() {
    setParseError(null);
    try {
      const obj = JSON.parse(truthJsonText) as ApplicantTruth;
      if (!obj.student_id || typeof obj.student_id !== 'string') {
        throw new Error('truth.student_id is required (string)');
      }
      if (!obj.citizenship || typeof obj.citizenship !== 'string') {
        throw new Error('truth.citizenship is required (ISO-2 string)');
      }
      if (targetStudentId && obj.student_id !== targetStudentId) {
        throw new Error(
          `target_student_id (${targetStudentId}) does not match truth.student_id (${obj.student_id})`,
        );
      }
      setParsedTruth(obj);
    } catch (e: any) {
      setParsedTruth(null);
      setParseError(e?.message || 'invalid JSON');
    }
  }

  // Console artifact for runtime proof — only when target context exists
  useEffect(() => {
    if (targetArtifact) {
      // eslint-disable-next-line no-console
      console.log('[Door3][live-smoke] harness artifact', targetArtifact);
      // Door 2 line preserved for backward compatibility with prior verification ask
      // eslint-disable-next-line no-console
      console.log('[Door2][live-smoke] truth+matrix', {
        student_id: targetArtifact.target_student_id,
        truth: targetArtifact.matrix.applicant_summary,
        matched_rule_ids: targetArtifact.matched_rule_ids,
        evidence_ids: targetArtifact.evidence_ids,
        countries_in_matrix: targetArtifact.countries_in_matrix,
      });
    }
  }, [targetArtifact]);

  return (
    <div className="container py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Target-Country — Eligibility &amp; Measurement Surface</h1>
        <p className="text-sm text-muted-foreground">
          After-secondary, country-level only · {fixtureArtifact.countries_in_matrix.length} packs · pure engine
        </p>
        <div className="mt-2 rounded border border-warning/40 bg-warning/5 p-3 text-xs space-y-1">
          <p className="font-medium uppercase text-warning">Truth status (see TRUTH_STATUS.md)</p>
          <p>
            <strong>Door 1</strong> = CLOSED ·{' '}
            <strong>Door 2</strong> = PARTIAL ·{' '}
            <strong>Door 3</strong> = PARTIAL
          </p>
          <p className="text-muted-foreground">
            Live target-student runtime is <strong>not</strong> authoritative: there is no
            admin-side CRM proxy that loads a target student's truth by{' '}
            <code>target_user_id</code>. The "Engine input forwarder" tab below accepts pasted
            JSON only — it is a developer convenience, not target-student runtime closure.
          </p>
          <p className="text-muted-foreground">
            TR (country-11) extensibility is "low-friction", <strong>not</strong> data-only:
            it required edits to the <code>CountryCode</code> union and the{' '}
            <code>COUNTRY_PACKS</code> registry.
          </p>
        </div>
      </div>

      <Tabs defaultValue="fixture">
        <TabsList>
          <TabsTrigger value="fixture">Fixture (proof)</TabsTrigger>
          <TabsTrigger value="target">Engine input forwarder (NOT live target)</TabsTrigger>
        </TabsList>

        <TabsContent value="fixture" className="mt-4">
          <HarnessView artifact={fixtureArtifact} label="synthetic" />
        </TabsContent>

        <TabsContent value="target" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Target student input</CardTitle>
              <p className="text-xs text-muted-foreground">
                Paste the canonical applicant truth JSON for a real target student. This page
                does not derive truth from the current admin actor.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  target_student_id (optional cross-check)
                </label>
                <Input
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  placeholder="student UUID — must match truth.student_id"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  applicant truth JSON
                </label>
                <Textarea
                  value={truthJsonText}
                  onChange={(e) => setTruthJsonText(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleRun}>Run harness on target student</Button>
                {parseError && (
                  <span className="text-xs text-destructive">{parseError}</span>
                )}
              </div>
              {!parsedTruth && !parseError && (
                <p className="text-xs text-muted-foreground">
                  admin route requires selected target student · fixture proof still
                  available in the other tab
                </p>
              )}
            </CardContent>
          </Card>

          {targetArtifact && (
            <HarnessView
              artifact={targetArtifact}
              label={`target · ${targetArtifact.target_student_id.slice(0, 12)}…`}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
