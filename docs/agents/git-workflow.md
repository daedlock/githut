# Git workflow

1. Branch from the latest `origin/main`.
2. Commit and push the feature branch; open a PR. The Preview workflow deploys it to its own URL (`pr-<n>-githut.<subdomain>.workers.dev`) and posts the link on the PR; test there before merging.
3. Merge only after required checks pass.
4. Production deploys from merged `main` via GitHub Actions; workflow dispatch only redeploys an existing `main` commit.
