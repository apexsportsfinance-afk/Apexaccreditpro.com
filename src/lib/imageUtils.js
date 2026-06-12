export const resizeImage = (dataUrl, maxWidth = 800, maxHeight = 600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
};

export const compressImage = async (file, maxSizeMB = 1) => {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const maxBytes = maxSizeMB * 1024 * 1024;
  let quality = 0.9;

  while (quality > 0.1) {
    const compressed = await resizeImage(dataUrl, 1200, 1200, quality);
    const base64Length = compressed.length - compressed.indexOf(",") - 1;
    const sizeBytes = (base64Length * 3) / 4;
    if (sizeBytes <= maxBytes) return compressed;
    quality -= 0.1;
  }

  return dataUrl;
};

export const getImageDimensions = (dataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
};

export const dataUrlToBlob = (dataUrl) => {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
};

// APX-PERF: Converts a standard Supabase storage URL to an Image Transformation API URL.
// Dramatically reduces payload sizes (e.g., 5MB -> 20KB).
export const getOptimizedImageUrl = (url, width = 150, quality = 70) => {
  if (!url) return url;
  if (!url.includes("supabase.co/storage/v1/object/public/")) return url;
  
  // Transform /object/ to /render/image/
  const optimized = url.replace(
    "/storage/v1/object/public/", 
    "/storage/v1/render/image/public/"
  );
  
  // Add query parameters for resizing
  return `${optimized}?width=${width}&quality=${quality}`;
};
