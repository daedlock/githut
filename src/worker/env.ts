export type Env = {
  ASSETS: Fetcher;
  UPLOADS: R2Bucket;
  APP_URL: string;
  /** Set only on PR previews: the production app they sign in through. */
  PRODUCTION_URL?: string;
  /** Production only: `<worker>.<subdomain>.workers.dev`, the host suffix of our PR previews. */
  PREVIEW_HOST_SUFFIX?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_STATE_SECRET: string;
};
