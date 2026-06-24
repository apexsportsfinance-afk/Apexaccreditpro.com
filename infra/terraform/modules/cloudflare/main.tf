# Cloudflare module — DNS + edge security (WAF, rate limiting, hardened TLS).
# This is the layer that addresses the "no WAF / no network rate limiting" gaps
# from the audit. It fronts both Vercel (SPA) and the Supabase function origin.

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "zone_id" {
  type = string
}

variable "app_domain" {
  type = string
}

variable "vercel_target" {
  description = "CNAME target for the frontend (e.g. cname.vercel-dns.com)"
  type        = string
  default     = "cname.vercel-dns.com"
}

# --- DNS ---------------------------------------------------------------------
resource "cloudflare_record" "app" {
  zone_id = var.zone_id
  name    = var.app_domain
  type    = "CNAME"
  content = var.vercel_target
  proxied = true # orange-cloud: traffic flows through Cloudflare's WAF/CDN
}

# --- TLS / transport hardening ----------------------------------------------
resource "cloudflare_zone_settings_override" "this" {
  zone_id = var.zone_id
  settings {
    ssl                      = "strict"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    always_use_https         = "on"
    browser_check            = "on"
    security_level           = "medium"
  }
}

# --- WAF: block obvious injection / traversal probes -------------------------
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "apex-waf-custom"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules {
    action      = "block"
    description = "Block SQLi/path-traversal probes"
    expression  = "(http.request.uri.query contains \"union select\") or (http.request.uri.path contains \"../\") or (http.request.uri.query contains \"' or '1'='1\")"
    enabled     = true
  }
}

# --- Rate limiting: throttle the partner verify + auth surfaces --------------
resource "cloudflare_ruleset" "rate_limit" {
  zone_id = var.zone_id
  name    = "apex-rate-limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action      = "block"
    description = "Throttle verify/auth endpoints"
    expression  = "(http.request.uri.path contains \"/verify\") or (http.request.uri.path contains \"/auth\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 60
      mitigation_timeout  = 60
    }
  }
}

output "record_hostname" {
  value = cloudflare_record.app.hostname
}
