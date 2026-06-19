# Supabase module — per-environment project configuration.
#
# NOTE on provider scope: the `supabase/supabase` provider manages project
# *settings*, branches, and secrets. Storage buckets, RLS policies, and PITR are
# managed elsewhere (SQL migrations in supabase/migrations and the dashboard /
# management API). Those are documented here so the full picture is in code even
# where Terraform can't yet enforce it.

terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

variable "project_ref" {
  description = "Supabase project ref for this environment"
  type        = string
}

variable "environment" {
  type = string
}

variable "function_secrets" {
  description = "Secrets exposed to edge functions (e.g. ALLOWED_ORIGINS, STRIPE_*)"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# API / Auth settings codified so they don't drift between environments.
resource "supabase_settings" "this" {
  project_ref = var.project_ref

  api = jsonencode({
    db_schema            = "public,storage,graphql_public"
    max_rows             = 1000
    db_extra_search_path = "public,extensions"
  })

  auth = jsonencode({
    # Short-lived access tokens; refresh rotation on. Long sessions are a risk.
    jwt_exp                  = 3600
    refresh_token_rotation_enabled = true
    security_refresh_token_reuse_interval = 10
  })
}

# Edge function secrets (ALLOWED_ORIGINS, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
# SUPABASE_SERVICE_ROLE_KEY is provided by the platform automatically).
resource "supabase_secrets" "functions" {
  project_ref = var.project_ref
  secrets     = var.function_secrets
}

# ---------------------------------------------------------------------------
# MANUAL / MIGRATION-MANAGED (documented, enforce in dashboard or SQL):
#   - Point-in-Time Recovery (PITR): enable on Pro+ for RPO in minutes.
#   - Supavisor connection pooling: enable transaction pooling for the API.
#   - Storage buckets: `accreditation-files`, `event-photos` must be PRIVATE
#     (see docs/EDGE_MIGRATION.md / storage cutover). Access via signed URLs.
#   - RLS: enforced by supabase/migrations/* (role trust hardening, key hashing).
# ---------------------------------------------------------------------------

output "project_ref" {
  value = var.project_ref
}
