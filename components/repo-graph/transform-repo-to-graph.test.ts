import { describe, expect, it } from "vitest";
import { transformRepoToGraph, type RawFunctionInput, type RawRepoInput } from "./transform-repo-to-graph";

describe("transformRepoToGraph", () => {
  const sampleRepo: RawRepoInput = {
    id: "repo-123",
    owner: "facebook",
    name: "react",
    commitSha: "abc1234",
    status: "indexed",
  };

  const sampleFunctions: RawFunctionInput[] = [
    {
      id: "fn-1",
      name: "createElement",
      filePath: "packages/react/src/ReactElement.js",
      language: "javascript",
      startLine: 10,
      endLine: 40,
      importance: 0.9,
      category: "entry",
      callers: 12,
      callees: 4,
      branches: 5,
    },
    {
      id: "fn-2",
      name: "validateChildKeys",
      filePath: "packages/react/src/ReactElement.js",
      language: "javascript",
      startLine: 45,
      endLine: 70,
      importance: 0.6,
      category: "helper",
      callers: 1,
      callees: 2,
      branches: 3,
    },
    {
      id: "fn-3",
      name: "useState",
      filePath: "packages/react/src/ReactHooks.js",
      language: "javascript",
      startLine: 15,
      endLine: 35,
      importance: 0.85,
      category: "core",
      dataAccess: true,
      callers: 25,
      callees: 2,
    },
  ];

  const sampleCalls = [
    { callerId: "fn-1", calleeId: "fn-2" },
  ];

  it("creates repository, folder, file, and function nodes correctly", () => {
    const graph = transformRepoToGraph(sampleRepo, sampleFunctions, sampleCalls);

    expect(graph.repositoryId).toBe("repo-123");
    expect(graph.commitSha).toBe("abc1234");
    expect(graph.isPartial).toBe(false);

    // Repository node
    const repoNode = graph.nodes.find((n) => n.type === "repository");
    expect(repoNode).toBeDefined();
    expect(repoNode?.name).toBe("facebook/react");

    // Folders
    const folderNodes = graph.nodes.filter((n) => n.type === "folder");
    expect(folderNodes.length).toBeGreaterThanOrEqual(1);

    // Files
    const fileNodes = graph.nodes.filter((n) => n.type === "file");
    expect(fileNodes.length).toBe(2);

    // Functions
    const fn1 = graph.nodes.find((n) => n.id === "fn-1");
    expect(fn1).toBeDefined();
    expect(fn1?.name).toBe("createElement");

    // Call edges
    const callEdge = graph.edges.find((e) => e.type === "calls");
    expect(callEdge).toBeDefined();
    expect(callEdge?.source).toBe("fn-1");
    expect(callEdge?.target).toBe("fn-2");
  });

  it("marks unindexed repos as partial graph with lower confidence", () => {
    const unindexed = { ...sampleRepo, status: "importing" };
    const graph = transformRepoToGraph(unindexed, []);

    expect(graph.isPartial).toBe(true);
    expect(graph.confidence).toBeLessThan(0.9);
    expect(graph.nodes).toHaveLength(1); // repo node only
  });

  it("identifies challenge candidate nodes correctly", () => {
    const graph = transformRepoToGraph(sampleRepo, sampleFunctions);
    const candidate = graph.nodes.find((n) => n.type === "challenge_candidate");
    expect(candidate).toBeDefined();
    expect(candidate?.challengeEligible).toBe(true);
  });
});
