# Data Retention & Erasure Procedure

Implements the retention schedule in `docs/PRIVACY.md` §6.

## Schedule
| Data | Table / location | Retention | Action after expiry |
|------|------------------|-----------|---------------------|
| Accreditation records | `public.accreditations` | Event end + 12 months | Delete row + linked files |
| Uploaded documents | `server/uploads/acc/` | With the accreditation | Delete file |
| Event photos | `public.event_photos`, `server/uploads/events/` | Until album deleted | Delete on request |
| Biometric face descriptors | not persisted — computed transiently in-browser at match time (`FaceMatchingManager.jsx`) | n/a (never stored) | nothing to delete; see `DPIA_BIOMETRICS.md` |
| Source photos (the only persisted biometric-relevant data) | `public.event_photos`, accreditation `photo_url` | governed by the photo rows above | delete photo → removes the sole face-matching input |
| Logs (app/function) | host / Supabase logs | 30 days | Auto-expire |
| Payment references | `accreditations`, `spectator_orders` | 7 years (tax) | Retain, then delete |

## Erasure (right to be forgotten)
A Controller/operator erasure request should:
1. Delete the `accreditations` row(s) for the subject (cascades booking data).
2. Delete associated uploaded files under `server/uploads/acc/` referenced by
   `photo_url` / `id_document_url` / `custom_message` URLs.
3. Delete any `event_photos` featuring the subject on request.
4. Face-matching descriptors require no action — they are never persisted
   (computed transiently in-browser); deleting the subject's photos (steps 2–3)
   removes the only input to face matching. See `DPIA_BIOMETRICS.md`.
5. Confirm completion to the requester.

## Recommended automation (follow-up)
- A scheduled job (Supabase cron / external) that purges `accreditations` whose
  event ended > 12 months ago and removes their orphaned upload files.
- Move uploads to Supabase Storage so deletion and lifecycle rules can be
  enforced centrally instead of on local disk.
