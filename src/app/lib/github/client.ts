import { Octokit } from "@octokit/core";
import { useAuthStore } from "@/app/stores/auth";

let cached: { token: string; client: Octokit } | null = null;

export function getGitHubClient(): Octokit {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Not authenticated");
  if (cached && cached.token === token) return cached.client;
  cached = {
    token,
    client: new Octokit({ auth: token, userAgent: "githut/0.1" }),
  };
  return cached.client;
}
