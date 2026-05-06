const RESERVED_PROFILE_PATHS = new Set(["login", "playground", "settings"]);

const FULL_WIDTH_REPO_PATHS = [/^commit\/[^/]+\/?$/, /^review\/\d+\/?$/] as const;

type LocationLike = {
  pathname: string;
  search?: Record<string, unknown>;
  hash?: string;
};

export function getOpenInGithubHref(location: LocationLike): string | null {
  const parts = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts.length === 1) {
    const [username] = parts;
    if (!username || RESERVED_PROFILE_PATHS.has(username.toLowerCase())) return null;
    return `https://github.com/${encodePathPart(username)}`;
  }

  const [owner, repo, ...restParts] = parts;
  if (!owner || !repo) return null;

  const restPath = restParts.join("/");
  if (FULL_WIDTH_REPO_PATHS.some((pattern) => pattern.test(restPath))) return null;

  const base = `https://github.com/${encodePathPart(owner)}/${encodePathPart(repo)}`;
  if (!restParts[0]) return base;

  switch (restParts[0]) {
    case "code":
      return codeHref(base, location);
    case "pulls":
      return `${base}/pulls`;
    case "pull":
      return pullHref(base, restParts);
    case "issues":
      return restParts[1] ? `${base}/issues/${encodePathPart(restParts[1])}` : `${base}/issues`;
    case "commits":
      return commitsHref(base, location);
    case "actions":
      return actionsHref(base, restParts);
    default:
      return base;
  }
}

function codeHref(base: string, location: LocationLike): string {
  const search = location.search ?? {};
  const path = stringSearchValue(search.path);
  const branch = stringSearchValue(search.branch) ?? "HEAD";
  const view = stringSearchValue(search.view) === "blob" ? "blob" : "tree";

  if (!path) {
    const branchFromSearch = stringSearchValue(search.branch);
    return branchFromSearch ? `${base}/tree/${encodePath(branchFromSearch)}` : base;
  }

  return `${base}/${view}/${encodePath(branch)}/${encodePath(path)}${lineHash(location.hash)}`;
}

function pullHref(base: string, restParts: string[]): string {
  const number = restParts[1];
  if (!number) return `${base}/pulls`;

  const tab = restParts[2];
  if (tab === "commits" || tab === "checks") {
    return `${base}/pull/${encodePathPart(number)}/${tab}`;
  }

  return `${base}/pull/${encodePathPart(number)}`;
}

function commitsHref(base: string, location: LocationLike): string {
  const branch = stringSearchValue(location.search?.branch);
  return branch ? `${base}/commits/${encodePath(branch)}` : `${base}/commits`;
}

function actionsHref(base: string, restParts: string[]): string {
  if (restParts[1] === "runs" && restParts[2]) {
    return `${base}/actions/runs/${encodePathPart(restParts[2])}`;
  }
  return `${base}/actions`;
}

function stringSearchValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function lineHash(hash: string | undefined): string {
  if (!hash) return "";
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  return /^#L\d+(?:C\d+)?(?:-L?\d+(?:C\d+)?)?$/i.test(normalized) ? normalized : "";
}

function encodePath(path: string): string {
  return path.split("/").filter(Boolean).map(encodePathPart).join("/");
}

function encodePathPart(part: string): string {
  return encodeURIComponent(part).replace(/%2F/gi, "/");
}
