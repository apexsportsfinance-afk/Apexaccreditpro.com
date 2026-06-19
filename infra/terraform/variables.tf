# Variables shared across environments. Provide values per-environment in
# environments/<env>.tfvars (those files hold non-secret config; real secrets
# come from TF_VAR_* env vars or a secrets manager).

variable "environment" {
  description = "Deployment environment: dev | staging | prod"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "region" {
  description = "Primary cloud region for the Supabase project"
  type        = string
  default     = "eu-central-1"
}

variable "app_domain" {
  description = "Public domain for this environment (e.g. accreditation.apexsports.ae)"
  type        = string
}

variable "allowed_origins" {
  description = "CORS allow-list passed to edge functions / API"
  type        = list(string)
  default     = []
}

# --- Secrets (provide via TF_VAR_* env vars; never commit) -------------------
variable "supabase_access_token" {
  type      = string
  sensitive = true
}

variable "vercel_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}
