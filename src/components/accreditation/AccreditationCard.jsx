const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false) => {
  const id = accreditation.id;
  if (downloadingId === id) return;
  setDownloadingId(id);

  try {
    // Capture front card
    const frontCanvas = await captureElement("accreditation-front-card", 3);
    
    // Create download link for PNG
    const link = document.createElement('a');
    link.download = `${accreditation.firstName}_${accreditation.lastName}_Card.png`;
    link.href = frontCanvas.toDataURL('image/png', 1.0);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Small delay for back card
    if (document.getElementById("accreditation-back-card")) {
      await new Promise(r => setTimeout(r, 300));
      const backCanvas = await captureElement("accreditation-back-card", 3);
      const link2 = document.createElement('a');
      link2.download = `${accreditation.firstName}_${accreditation.lastName}_Card_Back.png`;
      link2.href = backCanvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link2);
      link2.click();
      document.body.removeChild(link2);
    }
    
    toast.success("Cards downloaded as PNG images!");
  } catch (err) {
    console.error("Download error:", err);
    toast.error("Failed to download: " + (err.message || "Unknown error"));
  } finally {
    setDownloadingId(null);
  }
}, [downloadingId, toast]);

// Simple capture function
const captureElement = async (elementId, scale = 3) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  return await html2canvas(element, {
    scale: scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: 320,
    height: 454
  });
};
