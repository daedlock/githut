import yaml from "yaml";

// ─── parseDispatchInputs ───────────────────────────────────────────────────
//
// Reads a workflow YAML and, if it triggers on `workflow_dispatch`, returns
// the typed input schema. Everything else about the workflow (jobs, other
// triggers) is ignored — this module exists purely to drive the dispatch
// dialog form.
//
// Handles the usual YAML shape variants for `on`:
//   on: workflow_dispatch               → dispatchable, no inputs
//   on: [push, workflow_dispatch]       → dispatchable, no inputs
//   on:
//     workflow_dispatch:                → dispatchable (null), no inputs
//   on:
//     workflow_dispatch:
//       inputs:                         → dispatchable, typed inputs
//         name: { ... }

export type DispatchInputType = "string" | "choice" | "boolean" | "environment" | "number";

export type DispatchInput = {
  key: string;
  type: DispatchInputType;
  description?: string;
  required: boolean;
  default?: string | boolean | number;
  options?: string[]; // for `type: choice`
};

export type WorkflowDispatchSchema = {
  /** True if the workflow has `workflow_dispatch` as a trigger. */
  dispatchable: boolean;
  inputs: DispatchInput[];
};

export function parseDispatchInputs(raw: string): WorkflowDispatchSchema {
  let parsed: unknown;
  try {
    parsed = yaml.parse(raw);
  } catch {
    return { dispatchable: false, inputs: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { dispatchable: false, inputs: [] };
  }

  const on = (parsed as { on?: unknown }).on;
  const dispatchNode = extractDispatchNode(on);
  if (dispatchNode === undefined) {
    return { dispatchable: false, inputs: [] };
  }

  // Dispatchable but no inputs configured.
  if (dispatchNode === null || typeof dispatchNode !== "object") {
    return { dispatchable: true, inputs: [] };
  }

  const inputsNode = (dispatchNode as { inputs?: unknown }).inputs;
  if (!inputsNode || typeof inputsNode !== "object") {
    return { dispatchable: true, inputs: [] };
  }

  const inputs: DispatchInput[] = [];
  for (const [key, node] of Object.entries(inputsNode as Record<string, unknown>)) {
    inputs.push(coerceInput(key, node));
  }
  return { dispatchable: true, inputs };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Finds the `workflow_dispatch` entry across `on`'s three shapes. Returns
 *   `undefined` — not dispatchable
 *   `null`      — dispatchable, no config
 *   object      — dispatchable with config (may contain `inputs`)
 */
function extractDispatchNode(on: unknown): unknown | undefined {
  if (on === "workflow_dispatch") return null;
  if (Array.isArray(on)) {
    return on.includes("workflow_dispatch") ? null : undefined;
  }
  if (on && typeof on === "object") {
    const record = on as Record<string, unknown>;
    if ("workflow_dispatch" in record) return record.workflow_dispatch ?? null;
  }
  return undefined;
}

function coerceInput(key: string, node: unknown): DispatchInput {
  if (!node || typeof node !== "object") {
    return { key, type: "string", required: false };
  }
  const obj = node as {
    description?: unknown;
    required?: unknown;
    default?: unknown;
    type?: unknown;
    options?: unknown;
  };
  const type = normalizeType(obj.type);
  return {
    key,
    type,
    description: typeof obj.description === "string" ? obj.description : undefined,
    required: obj.required === true,
    default:
      type === "boolean"
        ? Boolean(obj.default)
        : type === "number"
          ? Number(obj.default ?? Number.NaN)
          : typeof obj.default === "string"
            ? obj.default
            : typeof obj.default === "number" || typeof obj.default === "boolean"
              ? obj.default
              : undefined,
    options:
      Array.isArray(obj.options)
        ? obj.options.filter((o): o is string => typeof o === "string")
        : undefined,
  };
}

function normalizeType(t: unknown): DispatchInputType {
  if (t === "choice" || t === "boolean" || t === "environment" || t === "number") return t;
  // GitHub's default when `type` is omitted is string.
  return "string";
}
