import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// HTML Card dimensions (pixels)
const CARD_WIDTH_PX = 320;
const CARD_HEIGHT_PX = 454;

// Convert pixels to mm (96px = 25.4mm)
const pxToMm = (px) => px * 25.4 / 96;
const CARD_WIDTH_MM = pxToMm(CARD_WIDTH_PX);
const CARD_HEIGHT_MM = pxToMm(CARD_HEIGHT_PX);

export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: CARD_WIDTH_MM, height: CARD_HEIGHT_MM, label: "Exact Card Size" },
};

const captureCardElement = async (elementId, scale = 3) => {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) throw new Error(`Element #${elementId} not found`);

  const originalParent = originalEl.parentNode;
  const originalNextSibling = originalEl.nextSibling;

  try {
    const sandbox = document.createElement('div');
    sandbox.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: ${CARD_WIDTH_PX + 100}px;
      height: ${CARD_HEIGHT_PX + 100}px;
      overflow: visible;
      z-index: 2147483647;
      background: white;
      visibility: visible;
      display: block;
    `;
    document.body.appendChild(sandbox);

    const clone = originalEl.cloneNode(true);
    clone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${CARD_WIDTH_PX}px;
      height: ${CARD_HEIGHT_PX}px;
      transform: none;
      margin: 0;
      opacity: 1;
      visibility: visible;
      overflow: hidden;
    `;

    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      img.crossOrigin = 'anonymous';
      img.loading = 'eager';
    });

    sandbox.appendChild(clone);
    clone.getBoundingClientRect();
    
    await Promise.all(Array.from(images).map(img => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) resolve();
        else {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 1000);
        }
      });
    }));

    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 200));

    const canvas = await html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0) throw new Error('Canvas has invalid dimensions');
    return canvas;
  } finally {
    const sandbox = document.querySelector('[style*="z-index: 2147483647"]');
    if (sandbox?.parentNode) sandbox.parentNode.removeChild(sandbox);
    
    if (originalNextSibling) originalParent.insertBefore(originalEl, originalNextSibling);
    else originalParent.appendChild(originalEl);
  }
};

export const downloadCardPDF = async (frontId, backId, filename, size = "card") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 3);
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.card;
    
    let pageWidth, pageHeight, imgWidth, imgHeight;
    
    if (size === "card") {
      // EXACT match to HTML
      pageWidth = CARD_WIDTH_MM;
      pageHeight = CARD_HEIGHT_MM;
      imgWidth = CARD_WIDTH_MM;
      imgHeight = CARD_HEIGHT_MM;
    } else {
      // Scale to fit A4/A5/A6
      pageWidth = sizeConfig.width;
      pageHeight = sizeConfig.height;
      const scale = Math.min(pageWidth / CARD_WIDTH_MM, pageHeight / CARD_HEIGHT_MM);
      imgWidth = CARD_WIDTH_MM * scale;
      imgHeight = CARD_HEIGHT_MM * scale;
    }
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight],
      compress: false
    });
    
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      0, 
      0, 
      imgWidth, 
      imgHeight
    );
    
    if (backId) {
      pdf.addPage([pageWidth, pageHeight]);
      const backCanvas = await captureCardElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        0, 
        0, 
        imgWidth, 
        imgHeight
      );
    }
    
    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('PDF Download Error:', error);
    throw error;
  }
};

export const openCardPDF = async (frontId, backId, size = "card") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 3);
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.card;
    
    let pageWidth, pageHeight, imgWidth, imgHeight;
    
    if (size === "card") {
      pageWidth = CARD_WIDTH_MM;
      pageHeight = CARD_HEIGHT_MM;
      imgWidth = CARD_WIDTH_MM;
      imgHeight = CARD_HEIGHT_MM;
    } else {
      pageWidth = sizeConfig.width;
      pageHeight = sizeConfig.height;
      const scale = Math.min(pageWidth / CARD_WIDTH_MM, pageHeight / CARD_HEIGHT_MM);
      imgWidth = CARD_WIDTH_MM * scale;
      imgHeight = CARD_HEIGHT_MM * scale;
    }
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight],
      compress: false
    });
    
    pdf.addImage(frontCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, imgWidth, imgHeight);
    
    if (backId) {
      pdf.addPage([pageWidth, pageHeight]);
      const backCanvas = await captureCardElement(backId, 3);
      pdf.addImage(backCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, imgWidth, imgHeight);
    }
    
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return true;
  } catch (error) {
    console.error('PDF Open Error:', error);
    throw error;
  }
};

export const printCard = async (frontId, backId, size = "card") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 2);
    const frontImage = frontCanvas.toDataURL('image/png');
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.card;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Accreditation Card</title>
          <style>
            @page { size: ${sizeConfig.width}mm ${sizeConfig.height}mm; margin: 0; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
            .card-container { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
            .card { max-width: 100%; max-height: 100%; object-fit: contain; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="card-container"><img src="${frontImage}" class="card" /></div>
          ${backId ? `<div style="page-break-after: always;"></div>` : ''}
        </body>
      </html>
    `);
    
    if (backId) {
      const backCanvas = await captureCardElement(backId, 2);
      const backImage = backCanvas.toDataURL('image/png');
      printWindow.document.body.innerHTML += `<div class="card-container"><img src="${backImage}" class="card" /></div>`;
    }
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
    
    return true;
  } catch (error) {
    console.error('Print Error:', error);
    throw error;
  }
};

export const bulkDownloadPDFs = async (accreditations, event, zones, size = "card") => {
  if (!accreditations || accreditations.length === 0) {
    throw new Error("No accreditations selected");
  }
  
  try {
    const zip = new JSZip();
    const folder = zip.folder("accreditation-cards");
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.card;
    
    for (let i = 0; i < accreditations.length; i++) {
      const acc = accreditations[i];
      
      try {
        const tempDiv = document.createElement('div');
        tempDiv.id = `temp-card-${acc.id}`;
        tempDiv.style.cssText = `
          width: ${CARD_WIDTH_PX}px;
          height: ${CARD_HEIGHT_PX}px;
          background: white;
          position: absolute;
          left: -9999px;
          top: 0;
          overflow: hidden;
          font-family: Arial, sans-serif;
        `;
        
        tempDiv.innerHTML = `
          <div style="width: 100%; height: 100%; position: relative; background: white;">
            <div style="background: #38bdf8; padding: 12px; text-align: center; color: white;">
              <div style="font-size: 12px; margin-bottom: 4px;">${event?.headerArabic || ''}</div>
              <div style="font-size: 14px; font-weight: bold;">${event?.name || 'EVENT'}</div>
            </div>
            
            <div style="background: ${getRoleColor(acc.role)}; padding: 8px; text-align: center; color: white; font-weight: bold; font-size: 16px; text-transform: uppercase;">
              ${acc.role || 'PARTICIPANT'}
            </div>
            
            <div style="padding: 16px; display: flex; gap: 16px;">
              <div style="width: 100px; height: 120px; flex-shrink: 0;">
                ${acc.photoUrl ? 
                  `<img src="${acc.photoUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />` :
                  `<div style="width: 100%; height: 100%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #64748b;">${acc.firstName?.[0]}${acc.lastName?.[0]}</div>`
                }
              </div>
              
              <div style="flex: 1;">
                <div style="font-size: 20px; font-weight: bold; color: #1e40af; margin-bottom: 8px; line-height: 1.2;">
                  ${acc.firstName?.toUpperCase()} ${acc.lastName?.toUpperCase()}
                </div>
                <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                  ${acc.club || ''}
                </div>
                <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
                  ${calculateAge(acc.dateOfBirth)} Y | ${acc.gender || ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <img src="https://flagcdn.com/w40/${acc.nationality?.toLowerCase()}.png" style="width: 24px; height: 16px; object-fit: cover;" />
                  <span style="font-size: 14px; color: #1e40af; font-weight: 600;">${acc.nationality}</span>
                </div>
              </div>
            </div>
            
            <div style="padding: 0 16px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">ID: ${acc.accreditationId || acc.id}</div>
              <div style="font-size: 11px; color: #64748b;">BADGE: ${acc.badgeNumber || 'PENDING'}</div>
            </div>
            
            <div style="padding: 0 16px; margin-bottom: 16px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${acc.accreditationId || acc.id}" style="width: 80px; height: 80px;" />
            </div>
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: #f8fafc; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #e2e8f0;">
              ${event?.sponsorLogos?.map(logo => 
                `<img src="${logo}" style="height: 24px; object-fit: contain;" />`
              ).join('') || ''}
              <div style="background: #1e40af; color: white; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; font-size: 14px;">
                ${acc.zoneCode || '9'}
              </div>
            </div>
          </div>
        `;
        
        document.body.appendChild(tempDiv);
        
        const canvas = await html2canvas(tempDiv, {
          scale: 3,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX
        });
        
        document.body.removeChild(tempDiv);
        
        let pageWidth, pageHeight, imgWidth, imgHeight;
        
        if (size === "card") {
          pageWidth = CARD_WIDTH_MM;
          pageHeight = CARD_HEIGHT_MM;
          imgWidth = CARD_WIDTH_MM;
          imgHeight = CARD_HEIGHT_MM;
        } else {
          pageWidth = sizeConfig.width;
          pageHeight = sizeConfig.height;
          const scale = Math.min(pageWidth / CARD_WIDTH_MM, pageHeight / CARD_HEIGHT_MM);
          imgWidth = CARD_WIDTH_MM * scale;
          imgHeight = CARD_HEIGHT_MM * scale;
        }
        
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [pageWidth, pageHeight],
          compress: false
        });
        
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, imgWidth, imgHeight);
        
        const pdfBlob = pdf.output('blob');
        const safeName = `${acc.firstName}_${acc.lastName}_${acc.badgeNumber || acc.id}`.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        folder.file(`${safeName}.pdf`, pdfBlob);
        
      } catch (err) {
        console.error(`Failed to process ${acc.firstName} ${acc.lastName}:`, err);
      }
    }
    
    const content = await zip.generateAsync({ type: "blob" });
    const eventName = (event?.name || 'export').replace(/[^a-z0-9]/gi, '_');
    saveAs(content, `accreditation-cards-${eventName}.zip`);
    
    return true;
  } catch (error) {
    console.error('Bulk Download Error:', error);
    throw error;
  }
};

const getRoleColor = (role) => {
  const colors = {
    'Athlete': '#3b82f6',
    'Coach': '#22c55e', 
    'Organizer': '#22c55e',
    'Official': '#f59e0b',
    'Media': '#8b5cf6',
    'Medical': '#ef4444',
    'Volunteer': '#06b6d4'
  };
  return colors[role] || '#64748b';
};

const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const diff = Date.now() - birthDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};
