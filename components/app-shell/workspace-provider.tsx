"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  createRoundSeed,
  repos as seedRepos,
  rounds as seedRounds,
  type Repository,
  type Round,
} from "@/lib/demo/mock-data";

export type WorkspaceUser = {
  name: string;
  email: string;
  initials: string;
  joined: string;
};

type Workspace = {
  user: WorkspaceUser;
  repositories: Repository[];
  addRepository: (repo: Repository) => void;
  rounds: Round[];
  setRounds: Dispatch<SetStateAction<Round[]>>;
  activeRound: Round;
  setCurrentRoundId: (id: string) => void;
  startRound: (repoId: string, functionIds: string[]) => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);

/**
 * Holds the signed-in user and the demo repos and rounds for every page in
 * the app shell. Lives in the layout, so state survives page changes.
 */
export function WorkspaceProvider({
  user,
  children,
}: {
  user: WorkspaceUser;
  children: ReactNode;
}) {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>(seedRepos);
  const [rounds, setRounds] = useState<Round[]>(seedRounds);
  const [currentRoundId, setCurrentRoundId] = useState("round-184");
  const activeRound = rounds.find((r) => r.id === currentRoundId) ?? rounds[0];

  function startRound(repoId: string, functionIds: string[]) {
    const repo = repositories.find((r) => r.id === repoId);
    if (!repo) return;
    const id = `round-${Date.now().toString().slice(-6)}`;
    const next: Round = {
      id,
      repoId,
      repoName: repo.name,
      status: "generating",
      date: "Just now",
      ...createRoundSeed(repo, functionIds),
      findings: [],
      score: 0,
      bugsFound: 0,
    };
    setRounds((prev) => [next, ...prev]);
    setCurrentRoundId(id);
    router.push(`/round/${id}`);
    window.setTimeout(
      () =>
        setRounds((prev) =>
          prev.map((r) =>
            r.id === id && r.status === "generating"
              ? { ...r, status: "in_progress" }
              : r,
          ),
        ),
      900,
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        repositories,
        addRepository: (repo) => setRepositories((old) => [repo, ...old]),
        rounds,
        setRounds,
        activeRound,
        setCurrentRoundId,
        startRound,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return workspace;
}
