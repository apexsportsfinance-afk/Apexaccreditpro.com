# Goal: Stabilize Badge PDF Rendering

Resolve rendering discrepancies where custom fields are missing from downloaded PDFs by forcing a deep module refresh in the background renderer and increasing stability timeouts.

## Proposed Changes

### Background Renderer Layer
#### [MODIFY] [pdfEmailHelper.js](file:///c:/Users/Administrator/OneDrive/Desktop/02) Apexaccreditpro.com-main/src/lib/pdfEmailHelper.js)
- **Remove Initialization Guard:** Removed the `if (jsPDF && ...)` check to ensure the background worker re-imports all dependencies for every PDF task.
- **Dynamic Imports:** Added query headers (`?v=${Date.now()}`) to the badge component import to bypass the worker process's module cache.
- **Improved Wait Logic:** Increased the render stabilization timeout to 450ms.

### Rendering Component Layer
#### [MODIFY] [AccreditationCardPreview.jsx](file:///c:/Users/Administrator/OneDrive/Desktop/02) Apexaccreditpro.com-main/src/components/accreditation/AccreditationCardPreview.jsx)
- **Refactored Custom Fields:** Standardized on `div` elements for custom field rendering to ensure consistent capture by `html2canvas`.

### Accreditation Edit Workflow

Summary: Resolve data loss where custom fields were stripped during admin edits/approvals.

#### [MODIFY] [EditAccreditationModal.jsx](file:///c:/Users/Administrator/OneDrive/Desktop/02) Apexaccreditpro.com-main/src/components/EditAccreditationModal.jsx)
- Load `customFields` into internal `formData` state on initialization.
- Fetch `customFieldConfigs` for the current event.
- Render dynamic inputs for all custom fields (Rifle, Professional status, etc.).
- Ensure `onSave` and `onApprove` payloads include the `customFields` object.

#### [MODIFY] [Accreditations.jsx](file:///c:/Users/Administrator/OneDrive/Desktop/02) Apexaccreditpro.com-main/src/pages/admin/Accreditations.jsx)
- Update `onApprove` and `onSave` handlers for the Edit Modal to correctly map `customFields` into the database update payload.

---

### PDF/Export Pipeline (Previously Implemented & Verified)
- Cache-busting imports in `pdfEmailHelper.js` are preserved.
- Rendering delays for stability are preserved.

## Verification Plan

### Automated Tests
- Trigger approval flow and verify that the resulting PDF in Supabase storage contains the most up-to-date custom fields and design.

### Manual Verification
1. Open Edit Modal for an accreditation with custom fields.
2. Verify that custom fields are visible and editable in the modal.
3. Save or Approve.
4. Verify in the database (or via PDF download) that the values are preserved.
5. Confirm that the generated PDF now correctly renders "10M RIFLE" etc. instead of blank boxes.
- User to re-approve a "problematic" accreditation and confirm the downloaded PDF matches the visual preview exactly.
