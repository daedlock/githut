export type Env = {
  ASSETS: Fetcher;
  UPLOADS: R2Bucket;
  APP_URL: string;
  /** Our zone (`githut.app`): preview hosts are its single-label subdomains. */
  PREVIEW_HOST_SUFFIX?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_STATE_SECRET: string;
};
