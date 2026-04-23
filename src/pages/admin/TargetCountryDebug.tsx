// ═══════════════════════════════════════════════════════════════
// Door 2 — Country Eligibility Debug Surface (Admin)
// ═══════════════════════════════════════════════════════════════
// Runs the country eligibility engine on:
//   1) FIXTURE_APPLICANT (deterministic proof)
//   2) Live DB profile of the signed-in user (smoke test)
// Renders a 10-country matrix with reasons, gaps, evidence.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  computeCountryMatrix,
  COUNTRY_PACKS,
  FIXTURE_APPLICANT,
  buildApplicantTruth,
  type CountryEligibility,
  type CountryMatrix,
  type CountryStatus,
} from '@/features/target-country';
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { useStudentDocuments } from '@/hooks/useStudentDocuments';
import { useCanonicalStudentFile } from '@/hooks/useCanonicalStudentFile';

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

export default function TargetCountryDebug() {
  const fixtureMatrix = useMemo(() => computeCountryMatrix(FIXTURE_APPLICANT), []);

  // ═══ Live smoke — same pipeline as Door 1 baseline ═══
  // CRM edge fn (StudentPortalProfile) → mapCrmToCanonical → buildApplicantTruth → engine
  const { profile, crmProfile, loading: profileLoading, error: profileError } = useStudentProfile();
  const { documents } = useStudentDocuments();
  const { canonicalFile } = useCanonicalStudentFile({
    crmProfile,
    documents,
    userId: profile?.user_id ?? null,
  });

  const liveTruth = useMemo(
    () => (canonicalFile ? buildApplicantTruth(canonicalFile) : null),
    [canonicalFile],
  );
  const liveMatrix = useMemo(
    () => (liveTruth ? computeCountryMatrix(liveTruth) : null),
    [liveTruth],
  );

  // Console artifact for runtime proof
  useEffect(() => {
    if (liveMatrix && canonicalFile) {
      // eslint-disable-next-line no-console
      console.log('[Door2][live-smoke] truth+matrix', {
        student_id: canonicalFile.student_id,
        truth: liveMatrix.applicant_summary,
        results: liveMatrix.results.map((r) => ({
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
  }, [liveMatrix, canonicalFile]);

  return (
    <div className="container py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Door 2 — Country Eligibility Matrix</h1>
        <p className="text-sm text-muted-foreground">
          After-secondary, country-level only · 10 packs · pure engine
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Live truth pipeline: <code>CRM edge fn → mapCrmToCanonical → buildApplicantTruth → engine</code>
        </p>
      </div>

      <Tabs defaultValue="fixture">
        <TabsList>
          <TabsTrigger value="fixture">Fixture (proof)</TabsTrigger>
          <TabsTrigger value="live">Live canonical (smoke)</TabsTrigger>
        </TabsList>
        <TabsContent value="fixture" className="mt-4">
          <MatrixView matrix={fixtureMatrix} label="synthetic" />
        </TabsContent>
        <TabsContent value="live" className="mt-4">
          {profileLoading && <p className="text-sm text-muted-foreground">Loading CRM profile…</p>}
          {profileError && <p className="text-sm text-destructive">CRM error: {profileError}</p>}
          {!profileLoading && !crmProfile && (
            <p className="text-sm text-muted-foreground">
              Sign in to compute the live matrix from canonical truth.
            </p>
          )}
          {liveMatrix && canonicalFile && (
            <MatrixView
              matrix={liveMatrix}
              label={`canonical · ${canonicalFile.student_id.slice(0, 8)}…`}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
