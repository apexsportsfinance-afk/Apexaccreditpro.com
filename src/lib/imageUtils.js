/**
 * Image utilities for PDF generation
 * Handles CORS issues by converting external images to base64
 */

/**
 * Load an image and convert to base64 data URL
 * Uses multiple methods for maximum compatibility
 */
export const loadImageAsBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  // Method 1: Try fetch with no-cors fallback
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
    });

    if (response.ok) {
      const blob = await response.blob();
      if (blob.type.startsWith("image/") || blob.size > 0) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (fetchError) {
    console.warn("Fetch method failed for:", url, fetchError.message);
  }

  // Method 2: Try using Image element + Canvas (bypasses some CORS)
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          resolve(dataUrl);
        } catch (canvasError) {
          console.warn("Canvas tainted for:", url);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      // Add cache-busting to avoid stale cached responses without CORS headers
      const separator = url.includes("?") ? "&" : "?";
      img.src = `${url}${separator}t=${Date.now()}`;
      // Timeout after 8 seconds
      setTimeout(() => resolve(null), 8000);
    });
  } catch (imgError) {
    console.warn("Image element method failed for:", url);
    return null;
  }
};

/**
 * Load multiple images and return a map of URL to base64
 */
export const loadImagesAsBase64 = async (urls) => {
  const results = {};
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  await Promise.all(
    uniqueUrls.map(async (url) => {
      results[url] = await loadImageAsBase64(url);
    })
  );
  return results;
};

/**
 * Pre-process accreditation data for PDF generation
 * Converts all external image URLs to base64
 * CRITICAL: Returns null for failed images to prevent React-PDF crash
 */
export const prepareAccreditationForPDF = async (accreditation, event) => {
  const imagesToLoad = [];
  if (accreditation?.photoUrl && !accreditation.photoUrl.startsWith("data:")) {
    imagesToLoad.push(accreditation.photoUrl);
  }
  if (event?.logoUrl && !event.logoUrl.startsWith("data:")) {
    imagesToLoad.push(event.logoUrl);
  }
  if (event?.backTemplateUrl && !event.backTemplateUrl.startsWith("data:")) {
    imagesToLoad.push(event.backTemplateUrl);
  }
  if (event?.sponsorLogos && Array.isArray(event.sponsorLogos)) {
    event.sponsorLogos.forEach(logo => {
      if (logo && !logo.startsWith("data:")) {
        imagesToLoad.push(logo);
      }
    });
  }

  const imageMap = await loadImagesAsBase64(imagesToLoad);

  // CRITICAL: If base64 load fails (returns null), pass null NOT original URL
  // Passing broken URL to React-PDF causes empty blob crash
  const processedAccreditation = {
    ...accreditation,
    photoUrl: accreditation.photoUrl?.startsWith("data:") 
      ? accreditation.photoUrl 
      : (imageMap[accreditation.photoUrl] || null)
  };

  const processedEvent = event ? {
    ...event,
    logoUrl: event.logoUrl?.startsWith("data:") 
      ? event.logoUrl 
      : (imageMap[event.logoUrl] || null),
    backTemplateUrl: event.backTemplateUrl?.startsWith("data:") 
      ? event.backTemplateUrl 
      : (imageMap[event.backTemplateUrl] || null),
    sponsorLogos: event.sponsorLogos?.map(logo => 
      logo?.startsWith("data:") ? logo : (imageMap[logo] || null)
    ).filter(Boolean)
  } : null;

  return { processedAccreditation, processedEvent };
};

/**
 * Generate flag URL and load as base64
 */
export const loadFlagAsBase64 = async (countryCode) => {
  if (!countryCode) return null;
  const flagUrl = `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
  return loadImageAsBase64(flagUrl);
};
