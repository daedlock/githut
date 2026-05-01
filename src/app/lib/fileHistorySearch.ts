import { z } from "zod";

/**
 * Shared search-param contract for the file-history sheet — appears as
 * optional fields on every route that hosts a `FileDiff` or `BlobViewer`.
 * Keys are short to keep URLs readable when shared.
 */
export const fileHistorySearchSchema = z.object({
  fhPath: z.string().optional(),
  fhSha: z.string().optional(),
  fhBranch: z.string().optional(),
  fhRail: z.enum(["1"]).optional(),
});

export type FileHistorySearch = z.infer<typeof fileHistorySearchSchema>;

export type FileHistoryOpenArgs = {
  path: string;
  sha: string;
  branch: string;
};

export const fileHistoryOpenSearch = (
  args: FileHistoryOpenArgs,
): Required<Pick<FileHistorySearch, "fhPath" | "fhSha" | "fhBranch">> => ({
  fhPath: args.path,
  fhSha: args.sha,
  fhBranch: args.branch,
});

export const fileHistoryClearSearch = (): {
  fhPath: undefined;
  fhSha: undefined;
  fhBranch: undefined;
  fhRail: undefined;
} => ({
  fhPath: undefined,
  fhSha: undefined,
  fhBranch: undefined,
  fhRail: undefined,
});
