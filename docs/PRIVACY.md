# Privacy Policy & Data Protection

_Last updated: 2026-06-19. This is an operational baseline; have legal counsel
review before publishing externally._

## 1. Who we are
ApexAccreditPro processes personal data on behalf of event organizers
("Controllers") to deliver accreditation, ticketing, scoring, and team-portal
services. For these activities ApexAccreditPro acts as a **Processor**.

## 2. Personal data we process
| Category | Examples | Purpose |
|----------|----------|---------|
| Identity | First/last name, date of birth, gender, nationality | Accreditation & badge issuance |
| Contact | Email, phone | Notifications, ticket delivery |
| Documents | ID/passport, Emirates ID, medical/emergency docs | Eligibility & safety verification |
| Biometric | Face images for face-matching (`face-api.js`) | Optional identity verification at check-in |
| Media | Event photos | Event galleries |
| Payment | Stripe session references (no card data stored) | Paid registration / tickets |

Card data is handled entirely by **Stripe Checkout**; it never touches our
systems (reduced PCI scope).

## 3. Sub-processors
- **Supabase** — database, auth, storage, edge functions.
- **Stripe** — payment processing.
- **Vercel** — frontend hosting / CDN.
- **flagcdn / jsDelivr** — static assets (flags, libraries).

Controllers must sign a Data Processing Agreement (DPA) with ApexAccreditPro and
are responsible for the lawful basis of the data they upload.

## 4. Special-category data
Medical/emergency documents and biometric (face) data are special-category data.
They are collected only where the event requires it, require explicit consent,
and are subject to the retention limits in §6. Face matching can be disabled
per event.

## 5. Data subject rights
Requests for access, rectification, erasure, or export should be routed to the
event Controller, who can action them in-platform or via the operator. Erasure
removes the accreditation record and associated uploaded files.

## 6. Retention
| Data | Default retention |
|------|-------------------|
| Accreditation records & documents | Duration of event + 12 months, then purge |
| Event photos | Until the Controller deletes the album |
| Biometric face data | Deleted within 30 days of event close |
| Payment references | As required by financial/tax law (typ. 7 years) |
| Application/function logs | 30 days |

See `docs/DATA_RETENTION.md` for the operational purge procedure.

## 7. Breach notification
Suspected breaches must be reported to affected Controllers without undue delay
and within 72 hours of becoming aware, per `docs/DR_RUNBOOK.md`.

## 8. Cookies & local storage
The app uses storage strictly necessary for authentication and offline
functionality (PWA). No third-party advertising/tracking cookies are set. If
analytics are added, a consent mechanism must gate non-essential storage.
