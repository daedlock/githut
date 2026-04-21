// Maps github.com URLs to in-app routes.
//
// To add a new mapping: append a rule to RULES. Order matters — the first rule
// whose `match` returns a result wins, so put more-specific patterns above
// less-specific ones.

type Rule = {
  name: string;
  // Given a URL path (pathname, starting with "/") return the in-app path,
  // or null to skip this rule and try the next one.
  match: (pathname: string) => string | null;
};

// Top-level github.com paths that are NOT usernames. Without this, the catch-all
// "/:user" rule would happily rewrite github.com/login → /login, etc.
const RESERVED_ROOT = new Set([
  "login",
  "logout",
  "join",
  "sessions",
  "settings",
  "notifications",
  "pulls",
  "issues",
  "marketplace",
  "explore",
  "topics",
  "trending",
  "collections",
  "events",
  "new",
  "organizations",
  "orgs",
  "enterprise",
  "about",
  "pricing",
  "features",
  "security",
  "contact",
  "search",
  "site",
  "customer-stories",
  "nonprofit",
  "team",
  "apps",
  "readme",
  "sponsors",
]);

const RULES: Rule[] = [
  {
    name: "repo:commit",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{4,40})\/?$/);
      return m ? `/${m[1]}/${m[2]}/commit/${m[3]}` : null;
    },
  },
  {
    name: "repo:commits",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/commits(?:\/.*)?$/);
      return m ? `/${m[1]}/${m[2]}/commits` : null;
    },
  },
  {
    // github.com/:owner/:repo/pulls, /pulls/:n, /pull/:n all land on our /pulls list.
    name: "repo:pulls",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/pulls?(?:\/\d+)?\/?$/);
      return m ? `/${m[1]}/${m[2]}/pulls` : null;
    },
  },
  {
    // github.com/:owner/:repo/issues[/:n] → our /issues list. No issue-detail route yet.
    name: "repo:issues",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/issues(?:\/\d+)?\/?$/);
      return m ? `/${m[1]}/${m[2]}/issues` : null;
    },
  },
  {
    // github.com/:owner/:repo/tree/... and /blob/... → code browser.
    name: "repo:code",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/(?:tree|blob)\/.*$/);
      return m ? `/${m[1]}/${m[2]}/code` : null;
    },
  },
  {
    name: "repo",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/([^/]+)\/?$/);
      return m ? `/${m[1]}/${m[2]}` : null;
    },
  },
  {
    name: "user",
    match: (p) => {
      const m = p.match(/^\/([^/]+)\/?$/);
      const name = m?.[1];
      if (!name) return null;
      if (RESERVED_ROOT.has(name.toLowerCase())) return null;
      return `/${name}`;
    },
  },
];

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

// If `href` points at a github.com page we have an in-app equivalent for, return
// that in-app path. Otherwise return null.
export function toInternalHref(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!GITHUB_HOSTS.has(url.host)) return null;

  for (const rule of RULES) {
    const mapped = rule.match(url.pathname);
    if (mapped) return mapped;
  }
  return null;
}

// Rewrite a github.com URL to its in-app equivalent if one exists; otherwise
// return the original href unchanged. Drop-in for any `<a href={...}>`.
export function rewriteGithubUrl(href: string): string {
  return toInternalHref(href) ?? href;
}
