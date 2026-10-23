import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
import { Button } from "@/components/ui/button";
import type { ProfileData } from "@/lib/scoring/load-profile";

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = { entry: "Entry points", core: "Core logic", data: "Data access", helper: "Helpers" };

/** SCORE-4: profile with understanding scores, skill profile, coverage and round history. */
export function ProfileView({ name, email, profile }: { name: string; email: string; profile: ProfileData }) {
  const attempts = profile.skills.reduce((n, s) => n + s.attempts, 0);
  const caught = profile.skills.reduce((n, s) => n + s.caught, 0);
  // Only types with misses are weak; a perfect record isn't a weak spot.
  const weakest = [...profile.skills]
    .filter((s) => s.attempts > 0 && s.caught < s.attempts)
    .sort((a, b) => a.caught / a.attempts - b.caught / b.attempts)[0];

  return (
    <div className="mx-auto max-w-[1040px] fade-in">
      <PageTitle
        eyebrow="Your learning profile"
        title={name}
        description={email}
        action={
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-profile-dashboard">
              Dashboard <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Functions reviewed", String(profile.functionScores.length), `Across ${profile.rounds.length} round${profile.rounds.length === 1 ? "" : "s"}`],
          ["Bugs caught", String(caught), `Of ${attempts} planted`],
          ["Coverage", `${profile.coverage.overall.percent}%`, `${profile.coverage.overall.reviewed} of ${profile.coverage.overall.eligible} eligible functions`],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-md border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-primary">{value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
          </div>
        ))}
      </div>

      <section className="mb-7" data-testid="profile-function-understanding">
        <SectionTitle aside={<span className="text-xs text-muted-foreground">Lowest first</span>}>Understanding by function</SectionTitle>
        {profile.functionScores.length === 0 ? (
          <EmptyState title="No scores yet" text="Finish a round to see how well you understand each function." />
        ) : (
          <div className="divide-y rounded-md border bg-card">
            {profile.functionScores.map((fn) => (
              <div key={fn.functionId} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{fn.name}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{fn.file}</div>
                  <div className="mt-2">
                    <Bar percent={fn.score} />
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-primary">
                  {fn.score}
                  <span className="text-[10px] font-normal text-muted-foreground"> / 100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mb-7 grid gap-7 lg:grid-cols-[1.25fr_0.75fr]">
        <section>
          <SectionTitle aside={<span className="text-xs text-muted-foreground">Caught / planted</span>}>Bug pattern skills</SectionTitle>
          {profile.skills.length === 0 ? (
            <EmptyState title="No drills graded yet" text="Submit a bug drill to start your skill profile." />
          ) : (
            <div className="overflow-hidden rounded-md border bg-card">
              {profile.skills.map((s, i) => (
                <div key={s.bugType} className={`px-4 py-3 ${i ? "border-t" : ""}`} data-testid={`skill-row-${s.bugType}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm">{s.bugType.replaceAll("_", " ")}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.caught} / {s.attempts}
                    </span>
                  </div>
                  <Bar percent={s.attempts ? (100 * s.caught) / s.attempts : 0} />
                </div>
              ))}
            </div>
          )}
          {weakest && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your next drills will plant more <strong>{weakest.bugType.replaceAll("_", " ")}</strong> bugs, your lowest catch rate.
            </p>
          )}
        </section>
        <section>
          <SectionTitle>Coverage by category</SectionTitle>
          <div className="rounded-md border bg-card p-4">
            {profile.coverage.categories.map((c) => (
              <div key={c.category} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="font-mono text-muted-foreground">
                    {c.reviewed} / {c.eligible}
                  </span>
                </div>
                <Bar percent={c.percent} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <SectionTitle>Past rounds</SectionTitle>
        {profile.rounds.length === 0 ? (
          <EmptyState title="No rounds yet" text="Import a repo and start your first round from the dashboard." />
        ) : (
          <div className="divide-y rounded-md border bg-card">
            {profile.rounds.map((r) => (
              <Link
                key={r.id}
                href={r.status === "completed" ? `/results/${r.id}` : `/round/${r.id}`}
                className="flex flex-col gap-1 px-4 py-3 text-sm hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                data-testid={`profile-round-${r.id}`}
              >
                <span className="min-w-0 truncate font-medium">{r.repo}</span>
                <span className="text-xs text-muted-foreground sm:shrink-0">
                  {r.size} functions · {new Date(r.createdAt).toLocaleDateString()} · {r.status === "completed" ? "Completed" : "In progress"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
