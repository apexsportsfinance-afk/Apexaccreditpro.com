# Branch protection & required checks (governance — rung 5)

Apply on the GitHub origin so `main` cannot be force-pushed or merged without
green CI. This closes the "CI required on the protected branch" exit-gate item
and removes the VSCode-auto-push risk noted in the live-isolation rules.

## Settings to apply (Settings → Branches → Add rule, branch = `main`)
- [ ] **Require a pull request before merging** (no direct pushes to `main`).
  - [ ] Require **1 approval**; dismiss stale approvals on new commits.
  - [ ] Require review from **Code Owners** (`.github/CODEOWNERS` already present).
- [ ] **Require status checks to pass before merging** → select the CI jobs from
      `.github/workflows/ci.yml`: **lint, typecheck, test (coverage), build, audit**.
  - [ ] Require branches to be **up to date** before merging.
- [ ] **Require conversation resolution** before merging.
- [ ] **Do not allow force pushes**; **do not allow deletions**.
- [ ] (Recommended) Include administrators in the restrictions.

## Same via `gh` CLI
```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=true" \
  -F "enforce_admins=true" \
  -F "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=lint" \
  -f "required_status_checks[contexts][]=typecheck" \
  -f "required_status_checks[contexts][]=test" \
  -f "required_status_checks[contexts][]=build" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"
```
(Adjust the `contexts` names to match the actual job names CI reports.)

## Also
- [ ] Move CI/deploy secrets into the platform secret store (GitHub Actions
      secrets / Vercel / Cloudflare env) — never commit `.env`. (The history purge,
      done last, removes the historical `.env`.)
- [ ] Protect `feat/institutional` similarly until it's merged, to stop accidental
      VSCode "Sync Changes" force-pushes.
