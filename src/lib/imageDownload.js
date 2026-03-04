import { supabase } from "./supabase";

/**
 * Download a base64 data URL or remote URL as a file
 */
const downloadDataUrl = (dataUrl, fileName) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) document.body.removeChild(link);
  }, 500);
};

/**
 * Detect file extension from base64 data URL
 */
const getExtFromDataUrl = (dataUrl) => {
  if (!dataUrl) return "jpg";
  if (dataUrl.includes("image/png")) return "png";
  if (dataUrl.includes("image/webp")) return "webp";
  if (dataUrl.includes("application/pdf")) return "pdf";
  return "jpg";
};

/**
 * Fetch full accreditation record with photo + document columns from DB
 */
const fetchFullRecord = async (accreditationId) => {
  const { data, error } = await supabase
    .from("accreditations")
    .select("id, first_name, last_name, photo_url, id_document_url")
    .eq("id", accreditationId)
    .single();
  if (error) throw error;
  return data;
};

/**
 * Download single photo for an accreditation
 */
export const downloadSinglePhoto = async (accreditation, type = "photo") => {
  let url = accreditation.photoUrl;

  if (!url || !url.startsWith("data:")) {
    const full = await fetchFullRecord(accreditation.id);
    url = type === "photo" ? full.photo_url : full.id_document_url;
  }

  if (!url) throw new Error("No file available to download");

  const ext = getExtFromDataUrl(url);
  const name = `${accreditation.firstName}_${accreditation.lastName}_${type}.${ext}`;
  downloadDataUrl(url, name);
};

/**
 * Download all documents for a single accreditation (photo + ID doc)
 */
export const downloadFullRecord = async (accreditation) => {
  const full = await fetchFullRecord(accreditation.id);
  let count = 0;

  if (full.photo_url) {
    const ext = getExtFromDataUrl(full.photo_url);
    downloadDataUrl(
      full.photo_url,
      `${accreditation.firstName}_${accreditation.lastName}_photo.${ext}`
    );
    count++;
  }

  if (full.id_document_url) {
    await new Promise((r) => setTimeout(r, 500));
    const ext = getExtFromDataUrl(full.id_document_url);
    downloadDataUrl(
      full.id_document_url,
      `${accreditation.firstName}_${accreditation.lastName}_document.${ext}`
    );
    count++;
  }

  if (count === 0) throw new Error("No documents found for this record");
  return count;
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
    .select("id, first_name, last_name, photo_url, id_document_url")
    .in("id", ids);

  if (error) throw error;

  const rowMap = {};
  (rows || []).forEach((r) => {
    rowMap[r.id] = r;
  });

  for (const acc of accreditations) {
    const row = rowMap[acc.id];
    if (!row) continue;
    const baseName = `${row.first_name || "Unknown"}_${row.last_name || "Unknown"}`;

    if (row.photo_url && row.photo_url.startsWith("data:")) {
      const ext = getExtFromDataUrl(row.photo_url);
      const rawB64 = row.photo_url.split(",")[1];
      if (rawB64) {
        zip.file(`${baseName}_photo.${ext}`, rawB64, { base64: true });
        addedCount++;
      }
    }

    if (row.id_document_url && row.id_document_url.startsWith("data:")) {
      const ext = getExtFromDataUrl(row.id_document_url);
      const rawB64 = row.id_document_url.split(",")[1];
      if (rawB64) {
        zip.file(`${baseName}_document.${ext}`, rawB64, { base64: true });
        addedCount++;
      }
    }
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
