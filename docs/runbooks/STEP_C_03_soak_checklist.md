# Step C.3 — Private-storage soak checklist (staging)

With the bucket private + `VITE_PRIVATE_STORAGE=true` deployed, walk these
surfaces on `https://apex-staging-2ft.pages.dev`. Every storage image/download
must resolve through a short-lived **signed** URL (look for `?token=...` in the
network tab). The HIGH-RISK item is the html2canvas card export under CORS.

Open DevTools → Network, filter `public-verify-assets` and `accreditation-files`.

## Anon / public surfaces
- [ ] **Verify** `/verify/<ACC_ID>` — profile photo renders (signed URL).
- [ ] Verify — Heat Sheet + Athlete Result download tiles open the PDFs (signed).
- [ ] Verify — Official/Technical/Safety doc tiles (if seeded) open (signed).
- [ ] Verify — Event Gallery expands; thumbnails + lightbox render (gallery scope).
- [ ] Verify — Live Scores (if seeded): team badges render or fall back to flag.
- [ ] Verify — broadcast "View File" attachment (if seeded) opens (signed).
- [ ] **Scanner** — scan/lookup an athlete; the 3 photo layouts render (signed).
- [ ] **ServiceCheckin** — athlete photo renders (signed).
- [ ] **GenericPass / InviteRegister / TeamRegister** — event logo renders (branding).
- [ ] TeamRegister — upload a logo; preview shows instantly (local blob, no network).

## Card previews — html2canvas + crossOrigin (THE risk)
- [ ] InviteRegister → complete a registration → AccreditationCard preview renders
      photo + logo + back template + sponsors (signed URLs, `crossOrigin=anonymous`).
- [ ] Export/download the card → the rasterized PNG/PDF includes ALL images
      (NOT blank/transparent where images should be). A blank image == CORS taint.
- [ ] Membership card variant, same checks.

### If html2canvas produces blank/tainted images
Supabase signed URLs are same-origin to the storage host and DO return CORS
headers, so `crossOrigin="anonymous"` should be honoured. If an image is tainted:
1. Confirm the `<img>` actually got a `?token=` signed URL (not the bare path).
2. Confirm the storage response carries `Access-Control-Allow-Origin` (Network →
   the image request → Response Headers). Supabase sends `*` for object reads.
3. Ensure the export waits for images to LOAD before capturing — in private mode
   the src is set asynchronously after the edge-fn resolves, so a capture fired
   too early sees unloaded images. If needed, gate export on the resolver's
   `loading` flag (usePublicAssetUrls returns `{ urls, loading }`).
4. As a last resort, raise the signed-URL TTL (the edge fn `expiresIn`, max 1h)
   so a URL minted at render is still valid at export time.

## Pass criteria
- No broken images on any surface; every storage asset request is a signed URL.
- Card exports are pixel-complete (no blank image regions).
- No `public-verify-assets` 4xx/5xx in the console for legitimate assets.
- Off-allowlist paths still return `{"urls":{}}` (re-run the C.1 anti-oracle curl).

## After a clean soak
- Record results + date in `project-staging-setup` memory.
- Live cutover stays a SEPARATE deliberate step (deploy fn to live, flip live
  bucket, set the live flag) — do NOT bundle it with staging.
