import { Octokit } from "@octokit/core";
import { logout } from "@/app/lib/auth";
import { useAuthStore } from "@/app/stores/auth";

let cached: { token: string; client: Octokit } | null = null;

export function getGitHubClient(): Octokit {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error("Not authenticated");
  if (cached && cached.token === token) return cached.client;

  const client = new Octokit({ auth: token, userAgent: "githut/0.1" });

  // If the token is revoked or expired GitHub returns 401.
  // Clear the session immediately so the user is sent back to login.
  client.hook.error("request", (error) => {
    if ("status" in error && error.status === 401) {
      cached = null;
      logout();
    }
    throw error;
  });

  cached = { token, client };
  return cached.client;
}
