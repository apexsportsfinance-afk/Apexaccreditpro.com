# Benchmark Scorecard

Industry thresholds an acquirer / auditor scores a SaaS against, with our
**honest current standing**. "Target" is the minimum to be credible; "Best-in-
class" is what top performers hit. These are targets to grow into — a basic
product at 99.9% uptime with SOC 2 on the roadmap is in good shape.

> Source context: current SaaS industry benchmarks (uptime tiers, retention,
> compliance standards). Business figures are industry context, not guarantees
> of what your investors/auditors will require.

## Reliability / Operations
| Metric | Target | Best-in-class | Us today | Gap |
|--------|--------|---------------|----------|-----|
| Uptime | 99.9% (≤8.76 h/yr) | 99.99% (≤52.6 min/yr) | **Unmeasured** (no monitoring yet) | Add uptime monitoring + SLA → see DR_RUNBOOK |
| Error visibility | Error tracking live | Tracing + SLOs | Seam wired ([observability.js](../src/lib/observability.js)), DSN not set | Install @sentry/react + DSN |
| RTO / RPO | Defined + tested | RPO mins (PITR), RTO <1h | Defined in [DR_RUNBOOK](DR_RUNBOOK.md); **restore not yet tested** | Run a restore drill (workflow nudges monthly) |
| CI quality gates | Automated | Blue/green + canary | audit+test+build hard gates ✅ | Add preview envs + migration gate |

## Engineering quality
| Metric | Target | Us today |
|--------|--------|----------|
| Automated tests | Critical paths covered | 52 unit tests + harness ✅ (early coverage) |
| Dependency security | 0 high/critical | 0 high/critical ✅ (2 moderate, risk-accepted) |
| Lint/format gates | Enforced | ESLint/Prettier in place; lint a non-blocking ratchet |
| Type safety | Typed data layer | JS today; TS is roadmap Phase 2 |

## Compliance standards (audit against these)
| Standard | What it covers | Us today |
|----------|----------------|----------|
| **ISO/IEC 27001** | Information/cloud security (usually pursued first) | Controls hardened (RLS, hashed keys, rate-limit); **not certified** |
| **ISO 22301** | Business continuity / DR | DR runbook started; drills not yet run |
| **ISO/IEC 20000-1** | Incident & service-level mgmt | Incident response in DR_RUNBOOK; no formal SLA yet |
| **ISO 9001** | Release quality | CI + tests give the spine; no formal QMS |
| **SOC 2 Type II** | Security/availability controls over time | Roadmap Phase 3 (Vanta/Drata) — biggest enterprise unlock |
| **GDPR / UAE PDPL** | Data protection | Privacy + retention docs added; DPAs/DPIA pending |

## Business metrics (instrument, then track)
We currently can't measure these — there's no analytics/funnel instrumentation.
That itself is a gap (you can't sell a number you don't track).
| Metric | Median | Best-in-class |
|--------|--------|---------------|
| Net revenue retention (NRR) | ~101% | 120%+ |
| YoY growth | ~26% | — |
| Gross margin (subscription) | 75%+ | — |
| CAC payback | 15–18 mo | <12 mo |
| LTV : CAC | 3:1 | 5:1 |

**Action:** add privacy-respecting analytics + funnel events (roadmap Phase 4) so
these become reportable in diligence.

## How to use this
Re-score quarterly. The cheapest movers right now: **uptime monitoring + error
tracking** (turns "unmeasured" into a number) and **a logged restore drill**
(turns DR from paper into proof).
