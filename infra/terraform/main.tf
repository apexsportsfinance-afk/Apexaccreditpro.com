# Root composition — wires the modules for a single environment. Select the
# environment with `-var-file=environments/<env>.tfvars`.

variable "supabase_project_ref" {
  type = string
}

variable "supabase_url" {
  type = string
}

variable "supabase_anon_key" {
  type      = string
  sensitive = true
}

variable "scanner_pin" {
  type      = string
  sensitive = true
}

variable "function_secrets" {
  type      = map(string)
  default   = {}
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}

variable "vercel_git_repo" {
  description = "owner/repo of the connected GitHub repository"
  type        = string
}

module "supabase" {
  source           = "./modules/supabase"
  project_ref      = var.supabase_project_ref
  environment      = var.environment
  function_secrets = var.function_secrets
}

module "vercel" {
  source            = "./modules/vercel"
  environment       = var.environment
  app_domain        = var.app_domain
  git_repo          = var.vercel_git_repo
  supabase_url      = var.supabase_url
  supabase_anon_key = var.supabase_anon_key
  scanner_pin       = var.scanner_pin
}

module "cloudflare" {
  source     = "./modules/cloudflare"
  zone_id    = var.cloudflare_zone_id
  app_domain = var.app_domain
}

output "environment" {
  value = var.environment
}

output "app_url" {
  value = "https://${var.app_domain}"
}
