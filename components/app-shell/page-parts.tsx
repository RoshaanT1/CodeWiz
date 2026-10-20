import { BookOpen, Code2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground"
      data-testid="link-logo"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Code2 size={16} />
      </span>
      {!small && <span>codewiz</span>}
    </Link>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[.09em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-card/50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <BookOpen size={16} className="text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function NotFoundMessage() {
  return (
    <div className="mx-auto max-w-[600px] py-20 text-center">
      <div className="font-mono text-xs text-primary">404 · NOT FOUND</div>
      <h1 className="mt-3 text-2xl font-semibold">This page isn’t here.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link may have changed or the page was removed.
      </p>
      <Link href="/dashboard">
        <Button className="mt-5">Go to dashboard</Button>
      </Link>
    </div>
  );
}
