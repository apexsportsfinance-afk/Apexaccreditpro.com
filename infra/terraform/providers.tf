# ============================================================================
# Infrastructure as Code — providers
#
# STATUS: SCAFFOLD. This defines the managed services the platform should be
# reproducible from. Fill in the account/project credentials via *.tfvars or
# environment variables (never commit secrets), then `terraform init`.
#
# Goal: `terraform apply` recreates an entire environment (Supabase project,
# Vercel project, Cloudflare zone/WAF) with no manual clicks.
# ============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Use a remote backend (e.g. Terraform Cloud or an S3 bucket) so state is
  # shared and locked across the team. Do NOT keep state on a laptop.
  # backend "remote" {
  #   organization = "apex"
  #   workspaces { prefix = "apexaccreditpro-" }
  # }
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
