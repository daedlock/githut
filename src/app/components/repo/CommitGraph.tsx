import type { CommitSummary } from "@/app/hooks/useRepoCommits";

export type CommitGraphNode = {
  sha: string;
  lane: number;
  before: string[];
  after: string[];
};

const LANE_W = 12;
const PAD_X = 7;
const ROW_H = 48;
const MID_Y = ROW_H / 2;

export function buildCommitGraph(commits: CommitSummary[]): Map<string, CommitGraphNode> {
  const active: string[] = [];
  const out = new Map<string, CommitGraphNode>();

  for (const commit of commits) {
    let lane = active.indexOf(commit.sha);
    if (lane === -1) {
      lane = active.indexOf("");
      if (lane === -1) lane = active.length;
      active[lane] = commit.sha;
    }

    const before = active.slice();
    const parents = commit.parents.map((p) => p.sha);

    if (parents.length === 0) {
      active.splice(lane, 1);
    } else {
      active[lane] = parents[0]!;
      for (let i = 1; i < parents.length; i++) {
        if (!active.includes(parents[i]!)) active.splice(lane + i, 0, parents[i]!);
      }
    }

    while (active[active.length - 1] === "") active.pop();

    out.set(commit.sha, {
      sha: commit.sha,
      lane,
      before,
      after: active.slice(),
    });
  }

  return out;
}

export function CommitGraphRail({ node }: { node: CommitGraphNode | undefined }) {
  if (!node) return <div className="w-5 shrink-0" />;

  const lanes = Math.max(node.before.length, node.after.length, node.lane + 1);
  const width = PAD_X * 2 + lanes * LANE_W;
  const dotX = laneX(node.lane);

  return (
    <svg
      width={width}
      height={ROW_H}
      viewBox={`0 0 ${width} ${ROW_H}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      {node.before.map(
        (sha, lane) =>
          sha && (
            <line
              key={`before-${sha}`}
              x1={laneX(lane)}
              x2={laneX(lane)}
              y1={0}
              y2={MID_Y}
              className="stroke-border"
              strokeWidth={1.5}
            />
          ),
      )}
      {node.after.map(
        (sha, lane) =>
          sha && (
            <line
              key={`after-${sha}`}
              x1={laneX(lane)}
              x2={laneX(lane)}
              y1={MID_Y}
              y2={ROW_H}
              className="stroke-border"
              strokeWidth={1.5}
            />
          ),
      )}
      {node.after.map((sha, lane) => {
        if (!sha || lane === node.lane) return null;
        const x = laneX(lane);
        const y2 = lane > node.lane ? MID_Y + 10 : MID_Y - 10;
        return (
          <path
            key={`join-${sha}`}
            d={`M ${dotX} ${MID_Y} C ${(dotX + x) / 2} ${MID_Y}, ${(dotX + x) / 2} ${y2}, ${x} ${y2}`}
            className="stroke-border"
            strokeWidth={1.5}
            fill="none"
          />
        );
      })}
      <circle
        cx={dotX}
        cy={MID_Y}
        r={4}
        className="fill-background stroke-muted-foreground"
        strokeWidth={1.5}
      />
      <circle cx={dotX} cy={MID_Y} r={2} className="fill-muted-foreground" />
    </svg>
  );
}

function laneX(lane: number) {
  return PAD_X + lane * LANE_W;
}
