import { groupByFolder } from "@/lib/repo-indexer/file-tree";

/** Files grouped by folder. Root files come first. */
export function FileGroups({ files }: { files: string[] }) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No source files found after skipping node_modules, dist, build, .next,
        vendor and binary files.
      </p>
    );
  }

  const groups = groupByFolder(files);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.folder || "(root)"}>
          <h3 className="flex items-baseline justify-between gap-2 border-b pb-1 text-sm font-semibold">
            <span className="break-all font-mono">
              {group.folder === "" ? "(repo root)" : `${group.folder}/`}
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {group.files.length} {group.files.length === 1 ? "file" : "files"}
            </span>
          </h3>
          <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {group.files.map((name) => (
              <li key={name} className="break-all font-mono text-muted-foreground">
                {name}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
