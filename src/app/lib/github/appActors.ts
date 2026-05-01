export type KnownGitHubAppActor = {
  reviewerLogin: string;
  mentionLogin: string;
  botLogin?: string;
  displayLogin: string;
  avatarUrl: string;
  description: string;
  aliases: string[];
};

export const KNOWN_GITHUB_APP_ACTORS: KnownGitHubAppActor[] = [
  {
    reviewerLogin: "Copilot",
    mentionLogin: "copilot-pull-request-reviewer",
    botLogin: "copilot-pull-request-reviewer[bot]",
    displayLogin: "Copilot",
    avatarUrl: "https://avatars.githubusercontent.com/in/946600?v=4",
    description: "GitHub Copilot",
    aliases: ["copilot", "github-copilot", "github copilot"],
  },
  {
    reviewerLogin: "coderabbitai[bot]",
    mentionLogin: "coderabbitai",
    botLogin: "coderabbitai[bot]",
    displayLogin: "coderabbitai[bot]",
    avatarUrl: "https://avatars.githubusercontent.com/in/347564?v=4",
    description: "CodeRabbit",
    aliases: ["coderabbit", "code rabbit", "coderabbitai", "coderabbitai[bot]"],
  },
];

function normalizeActorQuery(value: string) {
  return value.trim().toLowerCase();
}

export function knownGitHubAppActorsForQuery(query: string) {
  const q = normalizeActorQuery(query);
  if (!q) return KNOWN_GITHUB_APP_ACTORS;
  return KNOWN_GITHUB_APP_ACTORS.filter((actor) => {
    const haystack = [
      actor.reviewerLogin,
      actor.mentionLogin,
      actor.botLogin ?? "",
      actor.displayLogin,
      actor.description,
      ...actor.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function knownGitHubAppActorForInput(input: string) {
  const q = normalizeActorQuery(input);
  if (!q) return null;
  return (
    KNOWN_GITHUB_APP_ACTORS.find((actor) =>
      [
        actor.reviewerLogin,
        actor.mentionLogin,
        actor.botLogin ?? "",
        actor.displayLogin,
        ...actor.aliases,
      ]
        .map((value) => value.toLowerCase())
        .includes(q),
    ) ?? null
  );
}

// Normal GitHub logins are alnum/dash. Bot pseudo-logins from GitHub Apps can
// end in `[bot]` and are accepted by several API surfaces.
const GITHUB_LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?(?:\[bot\])?$/;

export function isLikelyGitHubLogin(value: string) {
  return GITHUB_LOGIN_RE.test(value.trim());
}

export function githubAvatarUrl(login: string) {
  return `https://github.com/${encodeURIComponent(login)}.png`;
}
