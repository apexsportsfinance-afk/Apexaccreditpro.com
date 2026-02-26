const handleDownloadPDF = useCallback(
  async (accreditation, openInBrowser = false) => {
    const id = accreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);

    try {
      const fileName = `${accreditation.firstName}_${accreditation.lastName}_${selectedPdfSize.toUpperCase()}_${accreditation.accreditationId || "accreditation"}.pdf`;

      if (openInBrowser) {
        await openCapturedPDFInTab(
          "accreditation-front-card",
          "accreditation-back-card"
        );
        toast.success("PDF opened in new tab!");
      } else {
        await downloadCapturedPDF(
          "accreditation-front-card",
          "accreditation-back-card",
          fileName
        );
        toast.success("PDF downloaded!");
      }
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  },
  [downloadingId, toast, selectedPdfSize]
);
