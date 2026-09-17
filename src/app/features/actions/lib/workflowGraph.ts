import { parseDocument } from "yaml";
import type { Job } from "../schemas";

export type WorkflowJob = {
  id: string;
  name: string;
  needs: string[];
  matrix: boolean;
  reusable: boolean;
};
export type WorkflowDefinition = { jobs: WorkflowJob[]; error?: string };
export type FlowNode = WorkflowJob & { jobs: Job[]; x: number; y: number; height: number };
export type WorkflowGraph = {
  nodes: FlowNode[];
  edges: { from: string; to: string }[];
  unmatched: Job[];
  width: number;
  height: number;
  warning?: string;
};
export const NODE_WIDTH = 272;
export const ROW_HEIGHT = 60;
const COLUMN_GAP = 80;
const NODE_GAP = 28;
const PADDING = 32;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseWorkflow(source: string): WorkflowDefinition {
  try {
    // Workflows are untrusted input: bound alias expansion and never evaluate expressions.
    const doc = parseDocument(source);
    if (doc.errors.length) throw new Error("Invalid YAML");
    const data: unknown = doc.toJS({ maxAliasCount: 100 });
    if (!record(data) || !record(data.jobs)) throw new Error("Missing jobs");
    const jobs: WorkflowJob[] = [];
    for (const [id, value] of Object.entries(data.jobs)) {
      if (!record(value)) continue;
      const needs =
        typeof value.needs === "string"
          ? [value.needs]
          : Array.isArray(value.needs)
            ? value.needs.filter((v): v is string => typeof v === "string")
            : [];
      jobs.push({
        id,
        name: typeof value.name === "string" ? value.name : id,
        needs: [...new Set(needs)],
        matrix: record(value.strategy) && !!value.strategy.matrix,
        reusable: typeof value.uses === "string",
      });
    }
    return { jobs };
  } catch {
    return {
      jobs: [],
      error:
        "The workflow definition could not be read. Jobs are shown without dependency connections.",
    };
  }
}

function matchScore(def: WorkflowJob, job: Job): number {
  if (job.name === def.name || job.name === def.id) return 3;
  const expression = /\$\{\{[\s\S]*?\}\}/g;
  const parts = def.name.split(expression);
  // An entirely dynamic name cannot identify a job reliably.
  if (parts.length > 1 && parts.some((s) => s.trim())) {
    const pattern = parts.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+?");
    if (new RegExp(`^${pattern}${def.reusable ? " / .+" : ""}$`).test(job.name)) return 1;
  }
  for (const name of [def.name, def.id]) {
    if (def.reusable && job.name.startsWith(`${name} / `)) return 2;
    if (
      def.matrix &&
      job.name.startsWith(`${name} (`) &&
      (job.name.endsWith(")") || (def.reusable && job.name.includes(") / ")))
    )
      return 2;
  }
  return 0;
}

export function buildWorkflowGraph(definition: WorkflowDefinition, jobs: Job[]): WorkflowGraph {
  const unmatched: Job[] = [];
  const nodes: FlowNode[] = definition.jobs.map((job) => ({
    ...job,
    jobs: [],
    x: 0,
    y: 0,
    height: 0,
  }));
  for (const job of jobs) {
    const scores = nodes.map((node) => matchScore(node, job));
    const best = Math.max(0, ...scores);
    const matches = nodes.filter((_, i) => best > 0 && scores[i] === best);
    // REST job objects do not expose the YAML job ID. Ambiguous display names
    // stay unconnected instead of implying a dependency we cannot establish.
    if (matches.length === 1) matches[0]!.jobs.push(job);
    else unmatched.push(job);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  let invalid = false;
  const level = (id: string): number => {
    const cached = levels.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      invalid = true;
      return 0;
    }
    visiting.add(id);
    const node = byId.get(id);
    let depth = 0;
    for (const dependency of node?.needs ?? []) {
      if (!byId.has(dependency)) {
        invalid = true;
        continue;
      }
      depth = Math.max(depth, level(dependency) + 1);
    }
    visiting.delete(id);
    levels.set(id, depth);
    return depth;
  };
  for (const node of nodes) level(node.id);
  const columns = new Map<number, FlowNode[]>();
  for (const node of nodes) {
    const column = invalid ? 0 : (levels.get(node.id) ?? 0);
    const grouped = node.matrix || node.reusable || node.jobs.length > 1;
    node.height = (grouped ? 36 : 0) + Math.max(1, node.jobs.length) * ROW_HEIGHT;
    node.x = PADDING + column * (NODE_WIDTH + COLUMN_GAP);
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }
  const height = Math.max(
    230,
    ...[...columns.values()].map(
      (column) =>
        column.reduce((sum, node) => sum + node.height + NODE_GAP, 0) - NODE_GAP + PADDING * 2,
    ),
  );
  for (const column of columns.values()) {
    const total = column.reduce((sum, node) => sum + node.height + NODE_GAP, -NODE_GAP);
    let y = (height - total) / 2;
    for (const node of column) {
      node.y = y;
      y += node.height + NODE_GAP;
    }
  }
  return {
    nodes,
    unmatched,
    height,
    width:
      PADDING * 2 +
      Math.max(1, columns.size) * NODE_WIDTH +
      Math.max(0, columns.size - 1) * COLUMN_GAP,
    edges: invalid
      ? []
      : nodes.flatMap((node) => node.needs.map((from) => ({ from, to: node.id }))),
    warning:
      definition.error ??
      (invalid ? "Some dependencies could not be resolved. Connections are hidden." : undefined),
  };
}
