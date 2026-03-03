import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const CARD_WIDTH_PX = 320;
const CARD_HEIGHT_PX = 454;

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
    
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 0, 0, imgWidth, imgHeight
    );
    
    if (backId) {
      pdf.addPage([pageWidth, pageHeight]);
      const backCanvas = await captureCardElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 0, 0, imgWidth, imgHeight
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

/**
 * Generate a high-res QR code as a data URL for bulk card generation.
 * Uses the qrcode library directly instead of the unreliable external API.
 */
const generateQrDataUrl = async (data, size = 200) => {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: size,
      color: { dark: "#000000", light: "#ffffff" }
    });
  } catch (err) {
    console.error("QR generation failed:", err);
    return null;
  }
};

const getRoleColor = (role) => {
  const colors = {
    'Athlete': '#3b82f6',
    'Coach': '#22c55e', 
    'Organizer': '#22c55e',
    'Official': '#7c3aed',
    'Media': '#d97706',
    'Medical': '#ef4444',
    'Volunteer': '#06b6d4',
    'Staff': '#475569',
    'VIP': '#b45309'
  };
  return colors[role] || '#64748b';
};

const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const diff = Date.now() - birthDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
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
        // Generate QR code locally instead of using external API
        const qrData = acc.accreditationId || acc.id;
        const qrUrl = `${window.location.origin}/verify/${qrData}`;
        const qrDataUrl = await generateQrDataUrl(qrUrl, 300);
        
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
        
        const zoneCodes = acc.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
        const zoneHtml = zoneCodes.map(code => 
          `<div style="background: #1e40af; color: white; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 4px;">${code}</div>`
        ).join('');

        tempDiv.innerHTML = `
          <div style="width: 100%; height: 100%; position: relative; background: white; display: flex; flex-direction: column;">
            <div style="background: linear-gradient(to right, #22d3ee, #7dd3fc, #22d3ee); padding: 12px; text-align: center; color: white; height: 100px; display: flex; align-items: center; justify-content: center;">
              ${event?.logoUrl 
                ? `<img src="${event.logoUrl}" style="max-height: 80px; max-width: 100%; object-fit: contain;" crossorigin="anonymous" />`
                : `<div style="font-size: 14px; font-weight: bold;">${event?.name || 'EVENT'}</div>`
              }
            </div>
            
            <div style="height: 6px; background: white;"></div>
            
            <div style="background: ${getRoleColor(acc.role)}; padding: 8px; text-align: center; color: white; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 0.2em; height: 40px; line-height: 24px;">
              ${acc.role || 'PARTICIPANT'}
            </div>
            
            <div style="padding: 12px; display: flex; flex: 1; overflow: hidden;">
              <div style="width: 110px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
                <div style="width: 100px; height: 120px; border: 2px solid #cbd5e1; padding: 2px; flex-shrink: 0;">
                  ${acc.photoUrl 
                    ? `<img src="${acc.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />`
                    : `<div style="width: 100%; height: 100%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #64748b;">${(acc.firstName?.[0] || '')}${(acc.lastName?.[0] || '')}</div>`
                  }
                </div>
                <div style="margin-top: 4px; text-align: left; width: 100%;">
                  <div style="font-size: 10px; color: #334155; font-family: monospace;">ID: ${acc.accreditationId?.split('-')?.pop() || '---'}</div>
                  <div style="font-size: 10px; color: #334155; font-family: monospace; font-weight: bold;">BADGE: ${acc.badgeNumber || '---'}</div>
                </div>
                ${qrDataUrl 
                  ? `<div style="margin-top: 6px; background: #fff; padding: 4px; border: 1px solid #e2e8f0;">
                      <img src="${qrDataUrl}" style="width: 90px; height: 90px; display: block; image-rendering: pixelated;" />
                    </div>`
                  : ''
                }
              </div>
              
              <div style="flex: 1; padding-left: 16px;">
                <div style="font-size: 20px; font-weight: bold; color: #1e3a8a; margin-bottom: 8px; line-height: 1.15; text-transform: uppercase;">
                  ${(acc.firstName || '').toUpperCase()} ${(acc.lastName || '').toUpperCase()}
                </div>
                <div style="font-size: 14px; color: #334155; margin-bottom: 4px;">
                  ${acc.club || ''}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
                  ${acc.role || ''}
                </div>
                <div style="font-size: 13px; color: #475569; margin-bottom: 16px;">
                  ${calculateAge(acc.dateOfBirth) ? calculateAge(acc.dateOfBirth) + ' Y | ' : ''}${acc.gender || ''}
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img src="https://flagcdn.com/w80/${acc.nationality?.toLowerCase()}.png" style="width: 44px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;" crossorigin="anonymous" onerror="this.style.display='none'" />
                  <span style="font-size: 16px; color: #1e40af; font-weight: bold;">${acc.nationality || ''}</span>
                </div>
              </div>
            </div>
            
            <div style="height: 26px; display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 0 12px; background: white;">
              ${zoneHtml || '<span style="font-size: 10px; color: #94a3b8;">No Access</span>'}
            </div>
            
            <div style="height: 36px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 0 12px; background: #f8fafc;">
              ${event?.sponsorLogos?.map(logo => 
                logo ? `<img src="${logo}" style="height: 26px; max-width: 50px; object-fit: contain;" crossorigin="anonymous" />` : ''
              ).join('') || '<span style="font-size: 8px; color: #94a3b8;">Sponsors</span>'}
            </div>
          </div>
        `;
        
        document.body.appendChild(tempDiv);
        
        // Wait for images to load
        const images = tempDiv.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => 
          new Promise(resolve => {
            if (img.complete) resolve();
            else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 2000); }
          })
        ));
        await new Promise(r => setTimeout(r, 200));
        
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
