"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RepoPreviewData } from "@/lib/repo-indexer/file-tree";

import { FileGroups } from "./file-groups";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "done"; data: RepoPreviewData };

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

export function RepoPreview() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "loading") return;
    if (!url.trim()) {
      setState({ status: "error", code: "INVALID_URL", message: "Enter a GitHub repo URL." });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/repos/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body: unknown = await res.json().catch(() => null);
      const json = body as
        | { ok: true; data: RepoPreviewData }
        | { ok: false; error: { code: string; message: string } }
        | null;
      if (json && json.ok) {
        setState({ status: "done", data: json.data });
      } else if (json && !json.ok) {
        setState({ status: "error", code: json.error.code, message: json.error.message });
      } else {
        setState({ status: "error", code: "UPSTREAM", message: "Something went wrong. Try again." });
      }
    } catch {
      setState({ status: "error", code: "NETWORK", message: NETWORK_ERROR });
    }
  }

  const loading = state.status === "loading";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preview a repo</CardTitle>
        <CardDescription>
          Paste a public GitHub repo URL to list its files by folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-2" noValidate>
          <Label htmlFor="repo-url">GitHub repo URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="repo-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              aria-invalid={state.status === "error"}
            />
            <Button type="submit" disabled={loading} className="shrink-0">
              {loading ? "Loading files…" : "Preview files"}
            </Button>
          </div>
        </form>

        {loading && (
          <p role="status" className="animate-pulse text-sm text-muted-foreground">
            Fetching the file list from GitHub…
          </p>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.message}
          </p>
        )}

        {state.status === "done" && <Result data={state.data} />}
      </CardContent>
    </Card>
  );
}

function Result({ data }: { data: RepoPreviewData }) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://github.com/${data.owner}/${data.repo}` }),
      });
      const json = await res.json();
      if (json.ok && json.data?.id) {
        window.location.href = `/repos/${json.data.id}`;
      } else {
        setImportError(json.error?.message ?? "Failed to create repo record.");
      }
    } catch {
      setImportError("Network error while creating repo.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-semibold">
            {data.owner}/{data.repo}
          </span>{" "}
          <span className="text-muted-foreground">
            · {data.fileCount} {data.fileCount === 1 ? "file" : "files"} on{" "}
            <span className="font-mono">{data.defaultBranch}</span>
          </span>
        </div>

        <Button onClick={handleImport} disabled={importing} size="sm">
          {importing ? "Creating Record…" : "Import & Map Repo →"}
        </Button>
      </div>

      {importError && (
        <p role="alert" className="text-xs text-destructive">
          {importError}
        </p>
      )}

      {data.requestedBranch && data.requestedBranch !== data.defaultBranch && (
        <p className="text-sm text-muted-foreground">
          Showing the default branch ({data.defaultBranch}). Branch selection
          isn&apos;t supported yet.
        </p>
      )}

      {data.truncated && (
        <p
          role="status"
          className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm"
        >
          Partial list: this repo is too large for GitHub to return every file,
          so some files are missing.
        </p>
      )}

      <FileGroups files={data.files} />
    </div>
  );
}
