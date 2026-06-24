# Data Protection Impact Assessment — Facial Recognition (Face Matching)

Status: **v1 (2026-06-19)** · Owner: ___ · Review cadence: annually or on any change
to the face-matching data flow. Required because the feature processes
**special-category biometric data** (GDPR Art. 9 / UAE PDPL) — see
`INSTITUTIONAL_ROADMAP.md` Phase 0.

> This DPIA documents the **current implementation as built**, verified against
> `src/components/accreditation/FaceMatchingManager.jsx`. Where a control is a
> target rather than a present fact, it is labelled **(target)**.

---

## 1. The processing — what actually happens

The "Face Matching" tool helps an operator find which event-gallery photos a given
accredited person appears in. Verified data flow:

1. Models load in the browser from a CDN
   (`FaceMatchingManager.jsx:7,17-19`).
2. For each gallery photo and the subject's accreditation photo, the browser
   fetches the image and computes a **face descriptor** (a numeric embedding)
   client-side (`:53-56`, `:74-75`).
3. Descriptors are compared with `faceapi.euclideanDistance` **in memory** and a
   match list is shown (`:83-84`).

**Key privacy fact (verified):** face **descriptors are never persisted** — not to
a database, not to `localStorage`/IndexedDB. They exist only transiently in the
browser tab during a matching run. A repo-wide search confirms descriptors are used
only in `FaceMatchingManager.jsx`. The only **persisted biometric-relevant data is
the source photographs** already stored for accreditation/event purposes.

## 2. Necessity & proportionality
- **Purpose:** operational efficiency in associating event photos with accredited
  participants (badging, galleries).
- **Necessity:** the same outcome is otherwise achieved by manual photo review;
  face matching reduces operator effort. Processing is **operator-initiated and
  ephemeral**, which is proportionate — it does not build a standing biometric
  database.
- **Data minimisation:** because descriptors are not stored, there is no biometric
  template store to secure, breach, or retain. This is the single most important
  proportionality control and it is **already in place by design**.

## 3. Lawful basis (to be confirmed by counsel)
- Art. 9 special-category processing requires an Art. 9(2) condition **in addition**
  to an Art. 6 basis. Candidate: **explicit consent** of the data subject, captured
  at registration. **(target)** — implement an explicit, separable consent for
  facial recognition and record it against the accreditation.
- For UAE PDPL, document the equivalent lawful basis and any cross-border transfer
  stance (Supabase region) — see `INSTITUTIONAL_ROADMAP.md` §Compliance.

## 4. Risks & mitigations
| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|-----------|--------|
| Standing biometric template store is breached | — | High | Descriptors are not persisted at all | **In place (by design)** |
| Source photos exposed via public bucket | Med | High | Private bucket + signed URLs | **(target)** — Phase 0 storage flip |
| False match → wrong person associated | Med | Med | Operator confirms before any action; show match distance/confidence; log overrides | **(target)** — add threshold + human confirmation + audit |
| No explicit consent for Art. 9 processing | Med | High | Separable facial-recognition consent at registration | **(target)** |
| Model weights loaded from an **unpinned third-party** `@master` CDN (`FaceMatchingManager.jsx:7`) | Med | Med | Pin to an immutable version/host; document provenance; fallback if unavailable | **(target)** — E18/E20 |
| Children's biometric data (youth sport) | Med | High | Heightened consent (guardian); consider disabling FR for minors | **(target)** — counsel input |

## 5. Retention & erasure
- **Descriptors:** none retained (nothing to delete).
- **Source photos:** governed by `docs/DATA_RETENTION.md` (event photos / accreditation
  photos). Erasure of a subject's photos removes the only input to face matching.
- **Correction needed:** `DATA_RETENTION.md`'s "Biometric face data — wherever face
  descriptors are stored — 30 days" row is inaccurate (no descriptors are stored);
  it has been corrected to govern the **source photos**, which is the real asset.

## 6. Data-subject rights
- **Access/erasure:** satisfied by the existing photo/accreditation erasure path
  (`DATA_RETENTION.md` §Erasure); no separate biometric store to traverse.
- **Objection to FR:** **(target)** — a subject who declines facial recognition
  should have their photos excluded from match runs (driven by the §3 consent flag).

## 7. Residual risk & sign-off
With the **(target)** items closed (storage flip, explicit consent, match-confidence
+ operator confirmation + audit, pinned model weights, minors handling), residual
risk is **Low** — primarily because no biometric template is retained. Until then,
residual risk is **Medium**, dominated by the public-bucket photo exposure (Phase 0)
and the absence of recorded consent.

| Role | Name | Date | Decision |
|------|------|------|----------|
| Owner / DPO | ___ | ___ | ___ |
| Legal / Privacy counsel | ___ | ___ | ___ |

_This DPIA must be revisited if descriptors ever become persisted, if matching moves
server-side, or if the feature is enabled for minors._
