# Biometric data handling (face matching)

**Posture: on-device processing, no biometric templates persisted.** Suitable for
GDPR (Art. 9 special-category data) / BIPA-style due diligence.

## How face matching works
The optional Event Photos face-matching feature
(`src/components/accreditation/FaceMatchingManager.jsx`) runs entirely in the
operator's browser using `face-api.js`:

1. Gallery photos and participant profile photos are loaded client-side.
2. Face **descriptors** (128-float embeddings) are computed in-browser
   (`detectAllFaces().withFaceDescriptors()`), held only in a local JS array
   (`galleryDescriptors`) for the duration of the run.
3. Matching is a local Euclidean-distance comparison (threshold 0.55).
4. **Only the match RESULT is persisted** — `accreditations.documents.matched_photos`
   stores matched **photo IDs**, never a descriptor or any biometric template.
5. Descriptors are discarded when the tab is closed; nothing is uploaded.

The UI states this to the operator: "Processing runs locally in your browser to
protect privacy and save server costs."

## What is NOT stored
- No face descriptors / embeddings in the database or storage.
- No biometric templates of any kind server-side.
- `matched_photos` is a list of gallery photo IDs (a relationship), not biometrics.

## Where descriptors appear in code
- `FaceMatchingManager.jsx` — computes + compares in memory only (above).
- `src/lib/fixtureGenerators.js` — generates synthetic descriptor arrays for
  TESTS; not a runtime persistence path.

## Implication for the roadmap
The Phase-0 "biometric purge" item is effectively **already satisfied**: there is
no persisted biometric data to purge. No code change required. If a future change
ever persists descriptors (e.g. to cache matching), it MUST add: explicit consent
capture, a retention limit, and a deletion path — re-open this item then.

## Residual considerations (not blockers)
- Gallery/profile photos themselves are personal data (covered by the storage
  privacy cutover — private bucket + signed URLs, Phase 0).
- The face-matching model files are loaded from the app origin; no third-party
  biometric processor is involved.
