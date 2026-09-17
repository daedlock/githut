import { describe, expect, test } from "bun:test";
import type { Job } from "../schemas";
import { buildWorkflowGraph, NODE_WIDTH, parseWorkflow } from "./workflowGraph";

function job(id: number, name: string): Job {
  return {
    id,
    name,
    run_id: 1,
    node_id: String(id),
    url: "",
    html_url: null,
    status: "queued",
    conclusion: null,
    steps: [],
    labels: [],
  };
}

describe("workflow dependency graph", () => {
  test("parallel jobs stay parallel and a join follows all its prerequisites", () => {
    const definition = parseWorkflow(`jobs:
  lint: {}
  test: {}
  build:
    needs: [lint, test]
  deploy:
    needs: build
`);
    const graph = buildWorkflowGraph(definition, [job(1, "lint"), job(2, "test"), job(3, "build")]);
    const [lint, tests, build, deploy] = graph.nodes;
    expect(lint!.x).toBe(tests!.x);
    expect(lint!.y).not.toBe(tests!.y);
    expect(build!.x).toBeGreaterThan(lint!.x + NODE_WIDTH);
    expect(deploy!.x).toBeGreaterThan(build!.x);
    expect(deploy!.jobs).toEqual([]);
    expect(graph.edges).toEqual([
      { from: "lint", to: "build" },
      { from: "test", to: "build" },
      { from: "build", to: "deploy" },
    ]);
  });

  test("groups matrix expansions and reusable workflow children", () => {
    const definition = parseWorkflow(`jobs:
  test:
    name: Tests
    strategy:
      matrix:
        os: [ubuntu, windows]
  release:
    name: Release
    needs: test
    uses: ./.github/workflows/release.yml
`);
    const graph = buildWorkflowGraph(definition, [
      job(1, "Tests (ubuntu)"),
      job(2, "Tests (windows)"),
      job(3, "Release / Build"),
      job(4, "Release / Deploy"),
    ]);
    expect(graph.nodes.map((node) => node.jobs.length)).toEqual([2, 2]);
    expect(graph.unmatched).toEqual([]);
    expect(graph.nodes[0]!.height).toBeGreaterThan(120);
  });

  test("matches custom matrix names without evaluating expressions", () => {
    const definition = parseWorkflow(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression, not JavaScript.
      "jobs:\n  test:\n    name: Test ${{ matrix.os }}\n    strategy:\n      matrix:\n        os: [linux, windows]",
    );
    const graph = buildWorkflowGraph(definition, [job(1, "Test linux"), job(2, "Test windows")]);
    expect(graph.nodes[0]!.jobs.length).toBe(2);
  });

  test("unknown and ambiguous names do not get fabricated dependencies", () => {
    const definition = parseWorkflow(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression, not JavaScript.
      "jobs:\n  a:\n    name: Build\n  b:\n    name: Build\n  c:\n    name: ${{ inputs.name }}",
    );
    const jobs = [job(1, "Build"), job(2, "Something else")];
    const graph = buildWorkflowGraph(definition, jobs);
    expect(graph.unmatched).toEqual(jobs);
    expect(graph.nodes.every((node) => !node.jobs.length)).toBe(true);
  });

  test("invalid YAML degrades to the runtime job list", () => {
    const jobs = [job(1, "Build")];
    const graph = buildWorkflowGraph(parseWorkflow("jobs: ["), jobs);
    expect(graph.warning).toBeDefined();
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.unmatched).toEqual(jobs);
  });

  test.each([
    "jobs:\n  a:\n    needs: b\n  b:\n    needs: a",
    "jobs:\n  a:\n    needs: nonexistent",
  ])("invalid dependencies suppress misleading edges: %s", (yaml) => {
    const graph = buildWorkflowGraph(parseWorkflow(yaml), []);
    expect(graph.warning).toBeDefined();
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    );
  });

  test("exact names take precedence over a broad dynamic name", () => {
    const definition = parseWorkflow(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression, not JavaScript.
      "jobs:\n  a:\n    name: Test linux\n  b:\n    name: Test ${{ matrix.os }}",
    );
    const graph = buildWorkflowGraph(definition, [job(1, "Test linux")]);
    expect(graph.nodes[0]!.jobs.length).toBe(1);
    expect(graph.nodes[1]!.jobs.length).toBe(0);
  });
});
