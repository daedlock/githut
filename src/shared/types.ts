export type RepoSummary = {
  id: number;
  name: string;
  fullName: string;
  owner: { login: string; avatarUrl: string; type: "User" | "Organization" };
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string;
  visibility: "public" | "private";
};
