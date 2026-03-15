import { supabase } from "./supabase";

/**
 * Uploads a file to Supabase Storage and returns its public URL.
 * @param {File} file - The file to upload.
 * @param {string} folder - Optional folder name within the bucket.
 * @returns {Promise<{url: string, filename: string}>}
 */
export async function uploadToStorage(file, folder = "general") {
  if (!file) throw new Error("No file provided");

  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("accreditation-files")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage Upload Error:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("accreditation-files")
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    filename: fileName,
  };
}
