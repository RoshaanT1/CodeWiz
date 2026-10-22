export type FunctionMetrics = {
  length: number;
  branches: number;
  callers: number;
  callees: number;
  dataAccess: boolean;
};

/**
 * MET-1: plain sentences about what a function's numbers mean for a reader.
 * Describes, never scores: there is no "good" or "bad" verdict on the code.
 */
export function describeMetrics(m: FunctionMetrics): string[] {
  const lines: string[] = [];
  lines.push(
    m.length < 15
      ? `At ${m.length} lines it fits on one screen, so you can read it in one go.`
      : m.length < 50
        ? `At ${m.length} lines it's worth reading in sections: what it takes in, what it decides, what it returns.`
        : `At ${m.length} lines it's long; skim for the main steps before reading details.`,
  );
  lines.push(
    m.branches === 0
      ? "It has no branches, so every call runs the same path."
      : m.branches <= 4
        ? `${m.branches} branch${m.branches === 1 ? "" : "es"} (ifs, loops, try blocks): a few paths to keep in mind.`
        : `${m.branches} branches: many paths, so edge cases are where bugs tend to hide.`,
  );
  lines.push(
    m.callers === 0
      ? "Nothing in the repo calls it, so it may be an entry point such as a route, command or export."
      : `${m.callers} function${m.callers === 1 ? " calls" : "s call"} it${m.callers >= 3 ? ", so a change here reaches a lot of code" : ""}.`,
  );
  lines.push(
    m.callees === 0
      ? "It calls no other functions in the repo, so it stands on its own."
      : `It relies on ${m.callees} other function${m.callees === 1 ? "" : "s"} in the repo.`,
  );
  if (m.dataAccess) lines.push("It touches data (a database, network or files), so errors and slow responses matter here.");
  return lines;
}
