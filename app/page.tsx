import { ArrowRight, Bug, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/app-shell/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STEPS = [
  ["01", "Import a repo", "Start with real code from a repository you know."],
  ["02", "Answer questions", "Describe what it does before looking for what could go wrong."],
  ["03", "Find the hidden bugs", "Trace a planted bug, then compare your reasoning with the evidence."],
];

function Ln({ n }: { n: number }) {
  return <span className="mr-4 text-muted-foreground">{n}</span>;
}

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/sign-in" className="px-2 py-2 sm:px-3 text-sm text-muted-foreground hover:text-foreground" data-testid="link-sign-in">
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button size="sm" data-testid="button-create-account">
              Create account <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5">
        <section className="grid items-center gap-10 border-b pb-14 pt-8 sm:gap-12 sm:pb-16 sm:pt-12 lg:min-h-[520px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-20">
          <div className="fade-in mx-auto max-w-[650px] text-center lg:mx-0 lg:text-left">
            <Badge variant="outline" className="mb-5 gap-1.5 sm:mb-6 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> A better way to read code
            </Badge>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-5xl lg:text-[54px]">
              Prove you understand the code you ship
            </h1>
            <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-7 text-muted-foreground sm:mt-6 sm:text-base lg:mx-0">
              Practice understanding real functions, trace their behavior, and catch the kind of bugs that make it into
              production.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/sign-up" className="sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto" data-testid="button-start-learning">
                  Start learning <ArrowRight size={15} />
                </Button>
              </Link>
              <Link href="/dashboard" className="sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-view-demo">
                  Explore demo
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:mt-8 lg:justify-start">
              <ShieldCheck size={14} className="text-primary" />
              Private by default · Your code stays yours
            </div>
          </div>
          <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-lg border bg-card shadow-sm lg:max-w-none">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
              <span className="ml-2 truncate font-mono text-[11px] text-muted-foreground">src/cache.ts · Cache.get</span>
            </div>
            <div className="overflow-x-auto whitespace-pre p-3 font-mono text-[11px] leading-7 sm:p-4 sm:text-[12px]">
              <div>
                <Ln n={18} />
                <span className="syntax-key">get</span>(key: string) {"{"}
              </div>
              <div>
                <Ln n={19} />
                {"  "}const entry = this.store.get(key);
              </div>
              <div className="-mx-2 rounded bg-amber-100/70 px-2 dark:bg-amber-900/20">
                <Ln n={20} />
                {"  "}
                <span className="syntax-key">if</span> (!entry?.value) <span className="syntax-key">return</span> undefined;
              </div>
              <div>
                <Ln n={21} />
                {"  "}
                <span className="syntax-key">if</span> (entry.expiresAt &lt; Date.now()) {"{"}
              </div>
              <div>
                <Ln n={22} />
                {"    "}this.store.delete(key);
              </div>
              <div>
                <Ln n={23} />
                {"    "}
                <span className="syntax-key">return</span> undefined;
              </div>
              <div>
                <Ln n={24} />
                {"  }"}
              </div>
              <div>
                <Ln n={25} />
                {"  "}
                <span className="syntax-key">return</span> entry.value;
              </div>
              <div>
                <Ln n={26} />
                {"}"}
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Bug size={13} /> Can you spot what breaks?
              </span>
              <span className="font-mono text-muted-foreground">1 of 3</span>
            </div>
          </div>
        </section>
        <section className="grid gap-8 border-b py-12 sm:py-16 lg:grid-cols-[260px_1fr] lg:gap-10">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-primary">A deliberate practice loop</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">Read. Reason. Review.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="border-t-2 border-primary/50 pt-4">
                <span className="font-mono text-xs text-muted-foreground">{n}</span>
                <h3 className="mt-3 text-sm font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="flex flex-col items-center justify-between gap-6 py-12 text-center sm:flex-row sm:py-16 sm:text-left">
          <div>
            <h2 className="text-xl font-semibold">Build confidence by reading code.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your next useful debugging instinct starts with practice.</p>
          </div>
          <Link href="/sign-up" className="shrink-0">
            <Button size="lg" data-testid="button-sign-up-bottom">
              Create your workspace <ArrowRight size={14} />
            </Button>
          </Link>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground">
          <Logo small />
          <span>CodeWiz · Learn by understanding.</span>
        </div>
      </footer>
    </div>
  );
}
