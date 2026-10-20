"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
import { useWorkspace } from "@/components/app-shell/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  profileCategoryCoverage,
  profileSummary,
  repos as seedRepos,
  rounds as seedRounds,
  skillScores,
} from "@/lib/demo/mock-data";

function Metric({ label, value, suffix, note }: { label: string; value: string; suffix?: string; note: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-primary">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

function FunctionUnderstanding() {
  const totals = new Map<string, { sum: number; count: number }>();
  seedRounds
    .filter((round) => round.status === "completed")
    .forEach((round) =>
      round.functionResults?.forEach((result) => {
        const current = totals.get(result.functionId) ?? { sum: 0, count: 0 };
        totals.set(result.functionId, { sum: current.sum + result.understanding, count: current.count + 1 });
      }),
    );
  const allFunctions = seedRepos.flatMap((repo) => repo.functions);
  const scores = Array.from(totals, ([id, value]) => ({
    fn: allFunctions.find((fn) => fn.id === id),
    score: Math.round(value.sum / value.count),
  })).filter((item): item is { fn: NonNullable<typeof item.fn>; score: number } => !!item.fn);

  return (
    <section className="mb-7" data-testid="profile-function-understanding">
      <SectionTitle aside={<span className="text-xs text-muted-foreground">Average across completed rounds</span>}>
        Understanding by function
      </SectionTitle>
      {scores.length ? (
        <div className="divide-y rounded-md border bg-card">
          {scores.map(({ fn, score }) => (
            <div key={fn.id} className="flex items-center gap-4 px-4 py-3" data-testid={`profile-function-score-${fn.id}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{fn.qualifiedName}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{fn.file}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                </div>
              </div>
              <div className="w-16 text-right font-mono text-sm font-semibold text-primary">
                {score}
                <span className="text-[10px] font-normal text-muted-foreground"> / 100</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground" data-testid="empty-function-scores">
          Complete a round to see understanding scores for individual functions.
        </div>
      )}
    </section>
  );
}

export function Profile() {
  const { user } = useWorkspace();
  const total = skillScores.reduce((n, s) => n + s.attempts, 0);
  const caught = skillScores.reduce((n, s) => n + s.caught, 0);

  return (
    <div className="mx-auto max-w-[1040px] fade-in">
      <PageTitle
        eyebrow="Your learning profile"
        title={user.name}
        description={`${user.email} · ${user.joined}`}
        action={
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-profile-dashboard">
              Dashboard <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Functions reviewed"
          value={String(profileSummary.functionsReviewed)}
          note={`Across ${profileSummary.completedRounds} practice rounds`}
        />
        <Metric label="Bug patterns caught" value={`${caught}`} note={`Of ${total} total attempts`} />
        <Metric label="Current streak" value={`${profileSummary.streakDays} days`} note="Keep the reading habit going" />
      </div>
      <FunctionUnderstanding />
      <div className="grid gap-7 lg:grid-cols-[1.25fr_0.75fr]">
        <section>
          <SectionTitle aside={<span className="text-xs text-muted-foreground">Caught / attempts</span>}>
            Bug pattern skills
          </SectionTitle>
          <div className="overflow-hidden rounded-md border bg-card">
            {skillScores.map((s, i) => (
              <div key={s.bugType} className={`px-4 py-3 ${i ? "border-t" : ""}`} data-testid={`skill-row-${s.bugType}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm">{s.bugType.replaceAll("_", " ")}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.caught}
                    <span className="mx-1">/</span>
                    {s.attempts}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${s.attempts ? (100 * s.caught) / s.attempts : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle>Repository coverage</SectionTitle>
          <div className="rounded-md border bg-card p-4">
            <p className="mb-4 text-xs text-muted-foreground">Functions explored by category</p>
            {profileCategoryCoverage.map(({ label, functions }) => (
              <div key={label} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{functions}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/75" style={{ width: `${functions * 7}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border bg-card p-4">
            <div className="text-sm font-semibold">Keep your learning balanced</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Revisit patterns where your catches are lower, especially exception handling and async behavior.
            </p>
            <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Choose a function <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
