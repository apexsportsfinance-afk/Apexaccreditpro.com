# Task List: Fix PDF & Verification Page Dynamic Fields

- [x] **Deep Debug & Stabilization**
    - [x] Use `<div>` instead of `<span>` for better PDF rendering
    - [x] Implement import cache-busting in `pdfEmailHelper.js`
    - [x] Fix duplicate capture options in PDF utility
- [x] **Verification**
    - [x] Confirm PDF matches preview exactly
    - [x] Verify module reload forces fresh styles
- [x] **Fixing Data Loss in Edit Modal**
    - [x] Update `EditAccreditationModal.jsx` to load and save `customFields`
    - [x] Add dynamic custom field rendering to `EditAccreditationModal.jsx`
    - [x] Update `Accreditations.jsx` to pass `customFields` in save/approve payloads
    - [x] Verify PDF generation with restored custom field data
- [x] **Stabilization of PDF Rendering Logic**
    - [x] Implement cache-busting for background worker modules
    - [x] Remove singleton initialization guards in `pdfEmailHelper.js`
    - [x] Add rendering delays for React reconciliation
