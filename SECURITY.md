# Security Policy

GitHut integrates with GitHub OAuth, repository data, pull request mutations, and optional Cloudflare R2 uploads. Please report security issues responsibly.

## Supported versions

Security fixes are applied to the `main` branch and deployed to https://githut.app as soon as practical.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for vulnerabilities.

Preferred reporting path:

1. Open a private GitHub Security Advisory for this repository.
2. Include a clear description, impact, and reproduction steps.
3. Include any relevant URLs, screenshots, request/response details, or proof-of-concept code.

If GitHub Security Advisories are unavailable to you, contact the repository owner privately through GitHub.

## What to include

A useful report includes:

- Vulnerability type and affected area.
- Exact steps to reproduce.
- Expected and actual behavior.
- Impact assessment, including whether private repository data, OAuth tokens, uploads, or user identity can be affected.
- Suggested mitigation if known.

Please do not include real OAuth tokens, cookies, or private repository data unless absolutely necessary. Redact secrets wherever possible.

## Response expectations

Maintainers aim to:

- Acknowledge reports within 3 business days.
- Triage severity and reproducibility.
- Keep reporters informed while a fix is prepared.
- Credit reporters when requested and appropriate.

## Scope

In scope:

- OAuth login/callback vulnerabilities.
- Token handling or leakage.
- Unauthorized access to repository data through GitHut.
- Upload handling, object access, and content-type issues.
- XSS, CSRF, open redirect, or injection vulnerabilities in GitHut.
- Privilege confusion around GitHub mutations, including PR merge/review actions.

Out of scope:

- Vulnerabilities in GitHub itself.
- Rate-limit exhaustion without a security impact.
- Social engineering.
- Issues requiring physical access to a user's device.
- Browser extensions, userscripts, or local malware interfering with GitHut.

## Safe harbor

We support good-faith security research. If you follow this policy, avoid privacy violations, avoid destructive testing, and give us a reasonable opportunity to fix issues before disclosure, we will not pursue legal action against you for your research.
