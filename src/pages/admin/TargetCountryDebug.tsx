// ═══════════════════════════════════════════════════════════════
// Door 2 — Country Eligibility Debug Surface (Admin)
// ═══════════════════════════════════════════════════════════════
// Admin page. Operates on TARGET STUDENT CONTEXT, not current actor.
// Tabs:
//   1) Fixture (proof)         — deterministic engine + 10 packs proof
//   2) Target student (smoke)  — admin pastes applicant truth JSON of
//                                a real target student → runs engine
//                                and emits live console artifact.
// Never falls back to current admin's signed-in identity for matrix.
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
  computeCountryMatrix,
  COUNTRY_PACKS,
  FIXTURE_APPLICANT,
  type ApplicantTruth,
  type CountryEligibility,
  type CountryMatrix,
  type CountryStatus,
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
            {pack.country_name_en}{' '}
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
                  {Object.keys(r.params).length > 0 && (
                    <pre className="text-[10px] bg-muted/40 p-1 rounded mt-0.5">
                      {JSON.stringify(r.params)}
                    </pre>
                  )}
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
              const ev = pack.evidence.find((e) => e.evidence_id === id);
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

function MatrixView({ matrix, label }: { matrix: CountryMatrix; label: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Applicant truth ({label})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/40 p-3 rounded overflow-auto">
            {JSON.stringify(matrix.applicant_summary, null, 2)}
          </pre>
          <p className="text-[11px] text-muted-foreground mt-2">
            generated_at {matrix.generated_at}
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {matrix.results.map((r) => (
          <CountryCard key={r.country_code} result={r} />
        ))}
      </div>
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
  local_language_signals: [],
};

export default function TargetCountryDebug() {
  const fixtureMatrix = useMemo(() => computeCountryMatrix(FIXTURE_APPLICANT), []);

  // ═══ Target student smoke — explicit admin-supplied context ═══
  // No reliance on current signed-in actor. Admin pastes the canonical
  // applicant truth of a real target student (built upstream from the
  // canonical Door 1 pipeline for that student_id).
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [truthJsonText, setTruthJsonText] = useState<string>(
    JSON.stringify(TRUTH_TEMPLATE, null, 2),
  );
  const [parsedTruth, setParsedTruth] = useState<ApplicantTruth | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const targetMatrix = useMemo(
    () => (parsedTruth ? computeCountryMatrix(parsedTruth) : null),
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
    if (targetMatrix && parsedTruth) {
      // eslint-disable-next-line no-console
      console.log('[Door2][live-smoke] truth+matrix', {
        student_id: parsedTruth.student_id,
        truth: targetMatrix.applicant_summary,
        results: targetMatrix.results.map((r) => ({
          country: r.country_code,
          status: r.status,
          eligible_paths: r.eligible_entry_paths,
          blocked_paths: r.blocked_entry_paths,
          matched_rule_ids: r.matched_rule_ids,
          evidence_ids: r.evidence_ids,
          confidence: r.confidence,
        })),
      });
    }
  }, [targetMatrix, parsedTruth]);

  return (
    <div className="container py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Door 2 — Country Eligibility Matrix</h1>
        <p className="text-sm text-muted-foreground">
          After-secondary, country-level only · 10 packs · pure engine
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Admin route. Operates on <strong>target student context</strong> only — never on
          current signed-in admin/staff identity.
        </p>
      </div>

      <Tabs defaultValue="fixture">
        <TabsList>
          <TabsTrigger value="fixture">Fixture (proof)</TabsTrigger>
          <TabsTrigger value="target">Target student (smoke)</TabsTrigger>
        </TabsList>

        <TabsContent value="fixture" className="mt-4">
          <MatrixView matrix={fixtureMatrix} label="synthetic" />
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
                <Button onClick={handleRun}>Run matrix on target student</Button>
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

          {targetMatrix && parsedTruth && (
            <MatrixView
              matrix={targetMatrix}
              label={`target · ${parsedTruth.student_id.slice(0, 12)}…`}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
