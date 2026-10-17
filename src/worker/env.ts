export type Env = {
  ASSETS: Fetcher;
  UPLOADS: R2Bucket;
  APP_URL: string;
  /** `<worker>.<account-subdomain>.workers.dev`: preview hosts are `<alias>-<suffix>`. */
  PREVIEW_HOST_SUFFIX?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_STATE_SECRET: string;
};
