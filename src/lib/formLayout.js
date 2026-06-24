// Registration form layout model.
//
// The public registration form (src/pages/public/Register.jsx) historically
// rendered a FIXED structure in JSX. This module lets each event define an
// ORDERED layout: which sections exist, their order, their (renamable) titles,
// and which fields live in each section and in what order.
//
// IMPORTANT design choices that keep this backward-compatible and low-risk:
//   * Field VISIBILITY and REQUIRED stay in the existing `field_config`
//     (standard fields) / custom-field `.required` + per-category allocation.
//     The layout only governs ORDER + SECTION MEMBERSHIP + SECTION TITLES.
//   * Field LABELS stay in the existing `label_overrides`.
//   * When an event has NO saved layout, buildDefaultLayout() reproduces the
//     exact original structure, so existing events render identically.
//
// Stored per event in global_settings under key: `event_<id>_form_layout`.

// Canonical placeable standard field ids (in their natural default order).
export const STANDARD_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "category_role",
  "organization",
  "participatingSports",
  "sportEvents",
  "email",
  "phone",
  "documents",
];

// Standard fields that render full-width (span both columns of a 2-col grid).
// The rest (firstName/lastName/gender/dateOfBirth) render half-width, matching
// the original layout.
export const FULL_WIDTH_FIELDS = new Set([
  "nationality",
  "organization",
  "participatingSports",
  "sportEvents",
  "email",
  "phone",
  "documents",
]);

// Human labels for standard items, used by the admin builder.
export const STANDARD_FIELD_LABELS = {
  firstName: "First Name",
  lastName: "Last Name",
  gender: "Gender",
  dateOfBirth: "Date of Birth",
  nationality: "Nationality",
  category_role: "Category / Role",
  organization: "Organization",
  participatingSports: "Participating Sports",
  sportEvents: "Event Schedule (athletes)",
  email: "Email",
  phone: "Phone Number",
  documents: "Documents (all required uploads)",
};

// Built-in sections whose header still resolves through translations /
// label_overrides via the form's t() helper. Custom sections use their own
// `title` string verbatim.
export const SECTION_TITLE_KEY = {
  personalInfo: "personalInfo",
  affiliation: "affiliation",
  contact: "contact",
  documents: "documents",
};

// Default label for the custom-fields section (legacy hardcoded header).
export const ADDITIONAL_INFO_DEFAULT_TITLE = "Additional Information";

const customRef = (id) => `custom:${id}`;
export const isCustomItem = (item) => typeof item === "string" && item.startsWith("custom:");
export const customIdOf = (item) => (isCustomItem(item) ? item.slice("custom:".length) : null);

// Reproduce the original form structure exactly.
export function buildDefaultLayout(customFields = []) {
  return [
    {
      id: "personalInfo",
      builtin: true,
      title: "",
      items: ["firstName", "lastName", "gender", "dateOfBirth", "nationality"],
    },
    {
      id: "affiliation",
      builtin: true,
      title: "",
      items: ["category_role", "organization", "participatingSports", "sportEvents"],
    },
    {
      id: "additionalInfo",
      builtin: true,
      title: ADDITIONAL_INFO_DEFAULT_TITLE,
      items: (customFields || []).map((f) => customRef(f.id)),
    },
    { id: "contact", builtin: true, title: "", items: ["email", "phone"] },
    { id: "documents", builtin: true, title: "", items: ["documents"] },
  ];
}

// Reconcile a saved layout with the current set of custom fields and the full
// set of standard fields:
//   * drop references to deleted custom fields,
//   * de-duplicate items,
//   * append any standard field that isn't placed yet (to its default section),
//   * append any custom field that isn't placed yet (to the additionalInfo
//     section if present, otherwise the last section),
// so nothing is ever silently lost when fields change.
export function normalizeLayout(saved, customFields = []) {
  const customRefs = (customFields || []).map((f) => customRef(f.id));
  const validCustom = new Set(customRefs);
  const validStandard = new Set(STANDARD_FIELDS);
  const isValidItem = (it) => validStandard.has(it) || validCustom.has(it);

  let sections;
  if (Array.isArray(saved) && saved.length > 0) {
    const seen = new Set();
    sections = saved
      .filter((s) => s && s.id)
      .map((s) => ({
        id: s.id,
        builtin: !!s.builtin,
        title: typeof s.title === "string" ? s.title : "",
        items: (Array.isArray(s.items) ? s.items : []).filter((it) => {
          if (seen.has(it) || !isValidItem(it)) return false;
          seen.add(it);
          return true;
        }),
      }));
  } else {
    sections = buildDefaultLayout(customFields);
  }

  const placed = new Set();
  sections.forEach((s) => s.items.forEach((it) => placed.add(it)));

  const ensureSection = (id) => {
    let sec = sections.find((s) => s.id === id);
    if (!sec) {
      const def = buildDefaultLayout(customFields).find((s) => s.id === id);
      sec = def
        ? { id: def.id, builtin: def.builtin, title: def.title, items: [] }
        : { id, builtin: true, title: "", items: [] };
      sections.push(sec);
    }
    return sec;
  };

  // Append missing standard fields to their natural default section.
  const defaults = buildDefaultLayout(customFields);
  STANDARD_FIELDS.forEach((fid) => {
    if (placed.has(fid)) return;
    const defSec = defaults.find((s) => s.items.includes(fid));
    const target = defSec ? ensureSection(defSec.id) : sections[sections.length - 1];
    if (target) {
      target.items.push(fid);
      placed.add(fid);
    }
  });

  // Append missing custom fields to the additionalInfo section (or last).
  customRefs.forEach((ref) => {
    if (placed.has(ref)) return;
    const target =
      sections.find((s) => s.id === "additionalInfo") || sections[sections.length - 1];
    if (target) {
      target.items.push(ref);
      placed.add(ref);
    }
  });

  return sections;
}

export { customRef };
