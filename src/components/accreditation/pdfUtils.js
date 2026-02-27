/**
 * pdfUtils.js — Final Working Version
 * Uses @react-pdf/renderer only. Zero html2canvas. Zero canvas errors.
 */
export const PDF_SIZES = {
  card: { w: 85.6,  h: 121.6, label: "ID Card (85.6 mm)" },
  a6:   { w: 105,   h: 148,   label: "A6 (105×148 mm)"   },
  a5:   { w: 148,   h: 210,   label: "A5 (148×210 mm)"   },
  a4:   { w: 210,   h: 297,   label: "A4 (210×297 mm)"   },
};

export const IMAGE_SIZES = {
  "640":  { scale: 2, label: "640"  },
  "1280": { scale: 4, label: "1280" },
  "2560": { scale: 8, label: "2560" },
};
