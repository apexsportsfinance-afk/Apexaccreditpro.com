# IP ownership & assignment (due-diligence — rung 5)

> **Not legal advice.** This is a record + template to be confirmed with counsel
> before a sale. A buyer's DD will ask for clean, assignable IP; this documents it.

## 1. Ownership statement
- The ApexAccreditPro codebase (this repository) and its associated assets
  (designs, docs, database schema) are owned by **<legal owner / company name>**.
- The product was primarily solo-authored. To the owner's knowledge there are **no
  third-party contributors** holding unassigned copyright in the committed source.
  *(If any contractor/freelancer touched the code, get a signed assignment — see §3.)*

## 2. Third-party components & licenses
- Dependencies are open-source under permissive licenses (MIT/Apache/ISC/BSD);
  see `package.json` + `package-lock.json`. No copyleft (GPL/AGPL) runtime
  dependency is intended — verify before sale with an SBOM:
  ```bash
  npx license-checker --summary        # or: npm sbom --sbom-format cyclonedx
  ```
- **Scan result (2026-06-21, `license-checker --production`, 365 packages):** clean —
  309 MIT, 32 ISC, 7 Apache-2.0, BSD variants; **no viral copyleft obligation.**
  Dual-licensed deps resolve permissive: `jszip` (MIT OR GPL → take **MIT**),
  `dompurify` (MPL OR Apache → take **Apache-2.0**). `caniuse-lite` is CC-BY-4.0
  (build-time browser data, attribution only). The one `UNLICENSED` entry is the
  root app itself (`accreditation-platform`), which is expected for private code.
- Action: [x] license scan clean (no AGPL/GPL runtime obligation);
  [ ] generate a formal SBOM file for the data room: `npm sbom --sbom-format cyclonedx > sbom.json`.

## 3. Contributor assignment (use if anyone else ever commits)
Short-form assignment to capture before merging any outside contribution:

> *I, <name>, irrevocably assign to <legal owner> all right, title, and interest
> (including copyright) in any contribution I have made or will make to the
> ApexAccreditPro repository, and waive any moral rights to the extent permitted
> by law. I warrant the contribution is my original work and free of third-party
> claims.*  — Signature / date.

For ongoing contributors, adopt a standard **CLA** (e.g. the Apache ICLA) instead
of per-contribution forms.

## 4. Pre-sale IP checklist (maps to the roadmap's sale-readiness list)
- [ ] Ownership statement above completed with the real legal entity.
- [ ] Signed assignment/CLA on file for **every** non-owner who touched the code.
- [ ] SBOM generated; license scan clean (no AGPL/GPL runtime dep).
- [ ] Trademarks/brand assets (the "APEX" marks, logos) ownership confirmed.
- [ ] Domain names + Supabase/Vercel/Cloudflare/Stripe accounts are held by the
      company entity (not a personal account) — or transfer plan documented.
- [ ] **Git history cleaned** of PII/secrets (the purge step) so the repo itself is
      deliverable. See [GIT_HISTORY_AUDIT.md](GIT_HISTORY_AUDIT.md).
