# Infrastructure as Code (Terraform)

**Status: scaffold.** This is the skeleton for making every environment
reproducible (the "no service runs on someone's laptop" requirement from the
institutional roadmap). It is intentionally minimal — wire in resources
incrementally and `plan` before every `apply`.

## Layout
```
infra/terraform/
  providers.tf              # supabase, vercel, cloudflare providers + backend
  variables.tf              # shared variables (config + sensitive tokens)
  environments/
    prod.tfvars.example     # copy to prod.tfvars (gitignored) and fill in
  modules/                  # add: supabase/, vercel/, cloudflare/
```

## Usage
```bash
cd infra/terraform
cp environments/prod.tfvars.example environments/prod.tfvars   # edit
export TF_VAR_supabase_access_token=...    # secrets via env, never in files
export TF_VAR_vercel_api_token=...
export TF_VAR_cloudflare_api_token=...

terraform init
terraform plan  -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars
```

## Build-out order (matches Roadmap Phase 1)
1. **State backend** — move state to Terraform Cloud / S3 + lock (uncomment in `providers.tf`).
2. **Supabase module** — project, PITR enabled, Supavisor pooling, storage buckets (private).
3. **Vercel module** — project, env vars, domain.
4. **Cloudflare module** — zone, DNS, WAF rules, rate-limiting, caching.
5. **Edge function deploy** — `verify-badge`, `parse-results`, payments (via `supabase functions deploy` in CI, referenced here for env/secrets).

## Guardrails
- Never commit `*.tfvars` (only `*.example`) or any token.
- Always `terraform plan` in CI on PRs; require approval before `apply` on prod.
- Keep dev/staging/prod as **separate** Supabase projects with separate keys.
