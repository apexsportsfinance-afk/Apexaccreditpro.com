import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// PDF Sizes for individual cards (in mm)
export const PDF_SIZES = {
  a4:   { width: 210, height: 297, label: "A4 (210×297 mm)" },
  a5:   { width: 148, height: 210, label: "A5 (148×210 mm)" },
  a6:   { width: 105, height: 148, label: "A6 (105×148 mm)" },
  card: { width: 85.6, height: 54,  label: "ID Card (85.6×54 mm)" },
};

// Fixed card dimensions (HTML element size)
const CARD_WIDTH = 320;
const CARD_HEIGHT = 454;

// Helper to calculate image dimensions maintaining aspect ratio
const calculateImageDimensions = (canvasWidth, canvasHeight, pageWidth, pageHeight) => {
  const canvasRatio = canvasWidth / canvasHeight;
  const pageRatio = pageWidth / pageHeight;
  
  let imgWidth, imgHeight, x, y;
  
  if (canvasRatio > pageRatio) {
    // Canvas is wider - fit to width
    imgWidth = pageWidth;
    imgHeight = pageWidth / canvasRatio;
    x = 0;
    y = (pageHeight - imgHeight) / 2;
  } else {
    // Canvas is taller - fit to height
    imgHeight = pageHeight;
    imgWidth = pageHeight * canvasRatio;
    x = (pageWidth - imgWidth) / 2;
    y = 0;
  }
  
  return { imgWidth, imgHeight, x, y };
};

const captureCardElement = async (elementId, scale = 3) => {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  const originalParent = originalEl.parentNode;
  const originalNextSibling = originalEl.nextSibling;

  try {
    // Create visible sandbox off-screen
    const sandbox = document.createElement('div');
    sandbox.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: ${CARD_WIDTH + 100}px;
      height: ${CARD_HEIGHT + 100}px;
      overflow: visible;
      z-index: 2147483647;
      background: white;
      visibility: visible;
      display: block;
    `;
    document.body.appendChild(sandbox);

    // Deep clone
    const clone = originalEl.cloneNode(true);
    
    // Apply exact dimensions
    clone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      transform: none;
      margin: 0;
      opacity: 1;
      visibility: visible;
      overflow: hidden;
    `;

    // Handle images
    const images = clone.querySelectorAll('img');
    images.forEach(img => {
      img.crossOrigin = 'anonymous';
      img.loading = 'eager';
      if (img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
        try {
          img.src = new URL(img.src, window.location.href).href;
        } catch(e) {}
      }
    });

    sandbox.appendChild(clone);
    clone.getBoundingClientRect();
    
    // Wait for images
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

    // Capture
    const canvas = await html2canvas(clone, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      x: 0,
      y: 0
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas has invalid dimensions');
    }

    return canvas;
  } finally {
    // Cleanup
    const sandbox = document.getElementById('pdf-capture-sandbox');
    if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
    
    // Restore original element if moved
    if (originalNextSibling) {
      originalParent.insertBefore(originalEl, originalNextSibling);
    } else {
      originalParent.appendChild(originalEl);
    }
  }
};

export const downloadCardPDF = async (frontId, backId, filename, size = "a6") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 3);
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });
    
    // Calculate dimensions maintaining aspect ratio
    const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
      CARD_WIDTH,
      CARD_HEIGHT,
      sizeConfig.width,
      sizeConfig.height
    );
    
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      x, 
      y, 
      imgWidth, 
      imgHeight
    );
    
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCardElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        x, 
        y, 
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

export const openCardPDF = async (frontId, backId, size = "a6") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 3);
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });
    
    const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
      CARD_WIDTH,
      CARD_HEIGHT,
      sizeConfig.width,
      sizeConfig.height
    );
    
    pdf.addImage(
      frontCanvas.toDataURL('image/png', 1.0), 
      'PNG', 
      x, 
      y, 
      imgWidth, 
      imgHeight
    );
    
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCardElement(backId, 3);
      pdf.addImage(
        backCanvas.toDataURL('image/png', 1.0), 
        'PNG', 
        x, 
        y, 
        imgWidth, 
        imgHeight
      );
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

export const printCard = async (frontId, backId, size = "a6") => {
  try {
    const frontCanvas = await captureCardElement(frontId, 2);
    const frontImage = frontCanvas.toDataURL('image/png');
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Accreditation Card</title>
          <style>
            @page { size: ${sizeConfig.width}mm ${sizeConfig.height}mm; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              background: white;
            }
            .card-container { 
              width: 100%; 
              height: 100%; 
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .card { 
              max-width: 100%; 
              max-height: 100%; 
              object-fit: contain;
            }
            @media print { 
              body { margin: 0; } 
            }
          </style>
        </head>
        <body>
          <div class="card-container">
            <img src="${frontImage}" class="card" />
          </div>
          ${backId ? `<div style="page-break-after: always;"></div>` : ''}
        </body>
      </html>
    `);
    
    if (backId) {
      const backCanvas = await captureCardElement(backId, 2);
      const backImage = backCanvas.toDataURL('image/png');
      printWindow.document.body.innerHTML += `
        <div class="card-container">
          <img src="${backImage}" class="card" />
        </div>
      `;
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

// Bulk download - also needs aspect ratio fix
export const bulkDownloadPDFs = async (accreditations, event, zones, size = "a6") => {
  if (!accreditations || accreditations.length === 0) {
    throw new Error("No accreditations selected");
  }
  
  try {
    const zip = new JSZip();
    const folder = zip.folder("accreditation-cards");
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    for (let i = 0; i < accreditations.length; i++) {
      const acc = accreditations[i];
      
      try {
        // Create temporary card element
        const tempDiv = document.createElement('div');
        tempDiv.id = `temp-card-${acc.id}`;
        tempDiv.style.cssText = `
          width: ${CARD_WIDTH}px;
          height: ${CARD_HEIGHT}px;
          background: white;
          position: absolute;
          left: -9999px;
          top: 0;
          overflow: hidden;
          font-family: Arial, sans-serif;
        `;
        
        // Build card HTML
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
          width: CARD_WIDTH,
          height: CARD_HEIGHT
        });
        
        document.body.removeChild(tempDiv);
        
        // Create PDF with aspect ratio fix
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [sizeConfig.width, sizeConfig.height],
          compress: false
        });
        
        const { imgWidth, imgHeight, x, y } = calculateImageDimensions(
          CARD_WIDTH,
          CARD_HEIGHT,
          sizeConfig.width,
          sizeConfig.height
        );
        
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', x, y, imgWidth, imgHeight);
        
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

// Helper functions
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
