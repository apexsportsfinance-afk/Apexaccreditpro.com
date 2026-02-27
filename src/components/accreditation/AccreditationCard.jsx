const handleDownloadPDF = useCallback(
  async (accreditation, openInBrowser = false) => {
    const id = accreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);

    try {
      const fileName = `${accreditation.firstName}_${accreditation.lastName}_${selectedPdfSize.toUpperCase()}_${accreditation.accreditationId || "accreditation"}.pdf`;

      const scale = 2; // HD quality (change to 6.25 for 600 DPI if needed)

      if (openInBrowser) {
        await openCapturedPDFInTab(
          "accreditation-front-card",
          "accreditation-back-card",
          scale,           // ✅ added
          selectedPdfSize  // ✅ added
        );
        toast.success("PDF opened in new tab!");
      } else {
        await downloadCapturedPDF(
          "accreditation-front-card",
          "accreditation-back-card",
          fileName,
          scale,           // ✅ added
          selectedPdfSize  // ✅ added
        );
        toast.success("PDF downloaded!");
      }
    } catch (err) {
      console.error("PDF error:", err);
      toast.error(err?.message || "Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  },
  [downloadingId, toast, selectedPdfSize]
);
