import { supabase } from "./supabase";

/**
 * Fetch a URL and return a blob
 */
const fetchAsBlob = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch image");
  return await response.blob();
};

/**
 * Detect file extension from base64 data URL or remote URL
 */
const getExtFromUrl = (url) => {
  if (!url) return "jpg";
  if (url.startsWith("data:")) {
    if (url.includes("image/png")) return "png";
    if (url.includes("image/webp")) return "webp";
    if (url.includes("application/pdf")) return "pdf";
    return "jpg";
  }
  // For remote URLs
  const parts = url.split("?")[0].split(".");
  const ext = parts.pop().toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "pdf"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
};

/**
 * Download a blob as a file
 */
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 5000);
};

/**
 * Fetch full accreditation record with photo + document columns + metadata from DB
 */
const fetchFullRecord = async (accreditationId) => {
  const { data, error } = await supabase
    .from("accreditations")
    .select("id, first_name, last_name, photo_url, id_document_url, club, custom_message")
    .eq("id", accreditationId)
    .single();
  if (error) throw error;
  return data;
};

/**
 * Download single photo for an accreditation
 */
export const downloadSinglePhoto = async (accreditation, type = "photo") => {
  let url = type === "photo" ? accreditation.photoUrl : accreditation.idDocumentUrl;

  if (!url) {
    const full = await fetchFullRecord(accreditation.id);
    url = type === "photo" ? full.photo_url : full.id_document_url;
  }

  if (!url) throw new Error("No file available to download");

  const ext = getExtFromUrl(url);
  const clubStr = accreditation.club ? `${accreditation.club.replace(/\s+/g, '_')}_` : "";
  const name = `${clubStr}${accreditation.firstName}_${accreditation.lastName}_${type}.${ext}`;

  if (url.startsWith("data:")) {
    const response = await fetch(url);
    const blob = await response.blob();
    downloadBlob(blob, name);
  } else {
    // Remote URL
    try {
      const blob = await fetchAsBlob(url);
      downloadBlob(blob, name);
    } catch (err) {
      // Fallback: try opening in new tab if fetch fails (CORS)
      window.open(url, "_blank");
    }
  }
};

/**
 * Download all documents for a single accreditation in a ZIP file
 */
export const downloadFullRecord = async (accreditation) => {
  const full = await fetchFullRecord(accreditation.id);
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let addedCount = 0;

  const clubStr = full.club ? `${full.club.replace(/\s+/g, '_')}_` : "";
  const baseName = `${clubStr}${full.first_name || "Unknown"}_${full.last_name || "Unknown"}`;

  const processFile = async (url, type) => {
    if (!url) return;
    try {
      const ext = getExtFromUrl(url);
      if (url.startsWith("data:")) {
        const rawB64 = url.split(",")[1];
        if (rawB64) {
          zip.file(`${baseName}_${type}.${ext}`, rawB64, { base64: true });
          addedCount++;
        }
      } else {
        // Remote URL (handle potential CORS issues with fetch)
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Network response was not ok");
          const blob = await response.blob();
          zip.file(`${baseName}_${type}.${ext}`, blob);
          addedCount++;
        } catch (fetchErr) {
          console.warn(`Could not fetch ${url} for ZIP, skipping:`, fetchErr);
        }
      }
    } catch (err) {
      console.error(`Failed to add ${type} for ${baseName}:`, err);
    }
  };

  // 1. Add standard files
  await processFile(full.photo_url, "photo");
  await processFile(full.id_document_url, "passport");

  // 2. Add custom files from metadata
  if (full.custom_message && full.custom_message.startsWith('{')) {
    try {
      const meta = JSON.parse(full.custom_message);
      for (const key of Object.keys(meta)) {
        if (key.endsWith('Url') && key !== 'textUrl') {
          const type = key.replace('Url', '');
          await processFile(meta[key], type);
        }
      }
    } catch (e) {
      console.warn("Failed to parse custom_message for extra documents:", e);
    }
  }

  if (addedCount === 0) throw new Error("No documents found for this record");

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}_documents.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return addedCount;
};

/**
 * Bulk download photos for multiple accreditations as a ZIP
 */
export const bulkDownloadPhotos = async (accreditations, eventName = "event") => {
  if (!accreditations || accreditations.length === 0) return;

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let addedCount = 0;

  const ids = accreditations.map((a) => a.id);

  const { data: rows, error } = await supabase
    .from("accreditations")
    .select("id, first_name, last_name, photo_url, id_document_url, club")
    .in("id", ids);

  if (error) throw error;

  const rowMap = {};
  (rows || []).forEach((r) => {
    rowMap[r.id] = r;
  });

  for (const acc of accreditations) {
    const row = rowMap[acc.id];
    if (!row) continue;
    const clubStr = row.club ? `${row.club.replace(/\s+/g, '_')}_` : "";
    const baseName = `${clubStr}${row.first_name || "Unknown"}_${row.last_name || "Unknown"}`;

    const processFile = async (url, type) => {
      if (!url) return;
      try {
        const ext = getExtFromUrl(url);
        if (url.startsWith("data:")) {
          const rawB64 = url.split(",")[1];
          if (rawB64) {
            zip.file(`${baseName}_${type}.${ext}`, rawB64, { base64: true });
            addedCount++;
          }
        } else {
          // Remote URL
          const response = await fetch(url);
          const blob = await response.blob();
          zip.file(`${baseName}_${type}.${ext}`, blob);
          addedCount++;
        }
      } catch (err) {
        console.error(`Failed to add ${type} for ${baseName}:`, err);
      }
    };

    await processFile(row.photo_url, "photo");
    // Only photos for bulk photos download to save space/time, 
    // but the function name suggests just photos.
  }

  if (addedCount === 0) {
    throw new Error("No downloadable images found in the selected records");
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `photos-${eventName.replace(/\s+/g, "-")}-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return addedCount;
};
