# Vercel module — frontend project, env vars, and domain.

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

variable "project_name" {
  type    = string
  default = "apexaccreditpro"
}

variable "environment" {
  type = string
}

variable "app_domain" {
  type = string
}

variable "git_repo" {
  description = "owner/repo for the connected Git repository"
  type        = string
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

resource "vercel_project" "this" {
  name      = "${var.project_name}-${var.environment}"
  framework = "vite"

  git_repository = {
    type = "github"
    repo = var.git_repo
  }

  # Production build only needs these present; the values come from here.
  build_command    = "npm run build"
  output_directory = "dist"
}

locals {
  env_vars = {
    VITE_SUPABASE_URL      = var.supabase_url
    VITE_SUPABASE_ANON_KEY = var.supabase_anon_key
    VITE_SCANNER_PIN       = var.scanner_pin
  }
}

resource "vercel_project_environment_variable" "vars" {
  for_each   = local.env_vars
  project_id = vercel_project.this.id
  key        = each.key
  value      = each.value
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_domain" "this" {
  project_id = vercel_project.this.id
  domain     = var.app_domain
}

output "project_id" {
  value = vercel_project.this.id
}
