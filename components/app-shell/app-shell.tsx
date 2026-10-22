"use client";

import {
  ChevronDown,
  Command,
  Github,
  LogOut,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Logo } from "./page-parts";
import { useTheme } from "./use-theme";
import { useWorkspace } from "./workspace-provider";

const NAV: [string, string, LucideIcon][] = [
  ["/dashboard", "Dashboard", Command],
  ["/profile", "Profile", UserRound],
];

function pageName(path: string) {
  if (path.startsWith("/repo")) return "Repository";
  if (path.startsWith("/round")) return "Practice round";
  if (path.startsWith("/results")) return "Results";
  return path.split("/")[1]?.replace("-", " ") ?? "";
}

function topNavClass(active: boolean) {
  return `rounded-md px-2 py-1.5 text-[11px] sm:px-2.5 sm:text-xs ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
}

/** `repos` are the signed-in user's imported repos, listed in the sidebar. */
export function AppShell({ children, repos }: { children: ReactNode; repos: { id: string; name: string }[] }) {
  const currentPath = usePathname();
  const { dark, toggleTheme } = useTheme();
  const { user } = useWorkspace();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded p-1.5 hover:bg-muted md:hidden"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
            data-testid="button-mobile-nav"
          >
            <Menu size={18} />
          </button>
          <Logo />
          <span className="hidden text-xs text-muted-foreground sm:inline">/</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {pageName(currentPath)}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary navigation">
            <Link
              href="/dashboard"
              className={topNavClass(currentPath === "/dashboard")}
              data-testid="top-nav-dashboard"
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className={topNavClass(currentPath === "/profile")}
              data-testid="top-nav-profile"
            >
              Profile
            </Link>
          </nav>
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <details className="relative">
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              data-testid="button-user-menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
                {user.initials}
              </span>
              <span className="hidden text-sm sm:block">{user.name}</span>
              <ChevronDown size={13} />
            </summary>
            <div className="absolute right-0 top-10 z-40 w-48 rounded-md border bg-popover p-1 shadow-md">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                data-testid="menu-profile"
              >
                <UserRound size={14} />
                Profile
              </Link>
              {/* POST only, so another site can't sign someone out with a link. */}
              <form action="/sign-out" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  data-testid="button-sign-out"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className={`${mobileNav ? "block" : "hidden"} fixed inset-y-14 left-0 z-20 w-60 border-r bg-sidebar px-3 py-4 md:sticky md:top-14 md:block md:h-[calc(100dvh-56px)] md:w-[220px] md:shrink-0`}
        >
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
            Workspace
          </div>
          <nav className="space-y-1">
            {NAV.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNav(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${currentPath === href ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-muted"}`}
                data-testid={`nav-${label.toLowerCase()}`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 flex items-center justify-between px-3 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
              Repositories
            </span>
            <Link
              href="/dashboard"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Add repository"
              data-testid="button-add-repo-nav"
            >
              <Plus size={14} />
            </Link>
          </div>
          <div className="space-y-0.5">
            {repos.length === 0 && <p className="px-3 py-2 text-[12px] text-muted-foreground">No repositories yet.</p>}
            {repos.map((r) => (
              <Link
                href={`/repo/${r.id}`}
                key={r.id}
                onClick={() => setMobileNav(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] ${currentPath === `/repo/${r.id}` ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-muted"}`}
                data-testid={`nav-repo-${r.id}`}
              >
                <Github size={14} className="text-muted-foreground" />
                <span className="truncate">{r.name}</span>
              </Link>
            ))}
          </div>
          <div className="absolute bottom-4 left-3 right-3 hidden rounded-md border bg-card p-3 md:block">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck size={14} className="text-primary" />
              Private learning
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Your practice stays in this workspace.
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
