# Git workflow

1. Branch from the latest `origin/main`.
2. Commit and push the feature branch; open a PR.
3. Merge only after required checks pass.
4. Production deploys from merged `main` via GitHub Actions; workflow dispatch only redeploys an existing `main` commit.
