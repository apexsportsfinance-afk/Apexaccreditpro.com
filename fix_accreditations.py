import os

file_path = r'c:\Users\Administrator\OneDrive\Desktop\02) Apexaccreditpro.com-main\src\pages\admin\Accreditations.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The target block to replace
target = """  const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false) => {
    const pdfAccreditation = accreditations.find(a => a.id === accreditation.id) || accreditation;

    // Priority: Use pre-cached PDF if available from latest data
    if (pdfAccreditation.documents?.accreditation_pdf) {
      const url = pdfAccreditation.documents.accreditation_pdf;
      if (openInBrowser) {
        window.open(url, '_blank');
        toast.success("PDF opened from cache!");
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = "_blank";
        link.download = `${pdfAccreditation.firstName}_${pdfAccreditation.lastName}_Card.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Downloading cached PDF...");
      }
      return;
    }

    const id = pdfAccreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    try {
      const fileName = `${pdfAccreditation.firstName}_${pdfAccreditation.lastName}_${selectedPdfSize.toUpperCase()}_${pdfAccreditation.accreditationId || "accreditation"}.pdf`;
      // Use the exact IDs rendered by the preview container
      const frontId = "accreditation-front-card";
      const backId = "accreditation-back-card";
      
      if (openInBrowser) {
        await openCapturedPDFInTab(frontId, backId, selectedPdfSize);
        toast.success("PDF opened in new tab!");
      } else {
        await downloadCapturedPDF(frontId, backId, fileName, selectedPdfSize);
        toast.success("PDF downloaded! Check your Downloads folder.");
      }
    } catch (err) {
      console.error("PDF capture error:", err);
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, toast, selectedPdfSize, accreditations, openCapturedPDFInTab, downloadCapturedPDF]);"""

replacement = """  const handleDownloadPDF = useCallback(async (accreditation, openInBrowser = false) => {
    const pdfAccreditation = accreditations.find(a => a.id === accreditation.id) || accreditation;

    // Priority: Use pre-cached PDF if available from latest data
    if (pdfAccreditation.documents?.accreditation_pdf) {
      const url = pdfAccreditation.documents.accreditation_pdf;
      if (openInBrowser) {
        window.open(url, '_blank');
        toast.success("PDF opened from cache!");
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = "_blank";
        link.download = `${pdfAccreditation.firstName}_${pdfAccreditation.lastName}_Card.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Downloading cached PDF...");
      }
      return;
    }

    const id = pdfAccreditation.id;
    if (downloadingId === id) return;
    setDownloadingId(id);
    
    // Dispatch to background queue
    addToQueue({
      type: "single_pdf_generate",
      id,
      accreditation: pdfAccreditation,
      eventId: selectedEvent,
      pdfSize: selectedPdfSize,
      onSuccess: (updated) => {
        setAccreditations(prev => prev.map(a => a.id === updated.id ? updated : a));
        setDownloadingId(null);
        
        // Final action: download or open
        const url = updated.documents?.accreditation_pdf;
        if (url) {
          if (openInBrowser) {
            window.open(url, '_blank');
          } else {
            const link = document.createElement('a');
            link.href = url;
            link.target = "_blank";
            link.download = `${updated.firstName}_${updated.lastName}_Card.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          toast.success(openInBrowser ? "PDF opened!" : "PDF downloaded!");
        }
      }
    });

    toast.info("Added to background processing...");
  }, [downloadingId, toast, selectedPdfSize, accreditations, addToQueue, selectedEvent]);"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replacement successful")
else:
    # Try with CRLF
    target_crlf = target.replace('\\n', '\\r\\n')
    if target_crlf in content:
        new_content = content.replace(target_crlf, replacement)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Replacement successful (CRLF)")
    else:
        print("Target not found. Length of content:", len(content))
        # Print a portion of the content to debug
        start_idx = content.find("const handleDownloadPDF")
        if start_idx != -1:
            print("Found 'handleDownloadPDF' at:", start_idx)
            print("Content around start:", repr(content[start_idx:start_idx+100]))
        else:
            print("'handleDownloadPDF' not found in content")
