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

// Helper to capture card element with high quality
const captureCard = async (elementId, scale = 3) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);
  
  return await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 0,
    removeContainer: true
  });
};

// Download single card as PDF - FIXED to maintain aspect ratio
export const downloadCardPDF = async (frontId, backId, filename, size = "a6") => {
  try {
    const frontCanvas = await captureCard(frontId, 3); // High scale for crisp text
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    
    // Create PDF with exact dimensions
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false // Better quality
    });
    
    // Convert canvas to image data
    const imgData = frontCanvas.toDataURL('image/png', 1.0);
    
    // Calculate dimensions to fill the PDF page while maintaining aspect ratio
    const pageWidth = sizeConfig.width;
    const pageHeight = sizeConfig.height;
    
    // Add image to fill entire page
    pdf.addImage(
      imgData, 
      'PNG', 
      0, // x
      0, // y
      pageWidth, // width - fill entire page
      pageHeight, // height - fill entire page
      undefined,
      'FAST' // Compression
    );
    
    // Add back side if provided
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCard(backId, 3);
      const backImgData = backCanvas.toDataURL('image/png', 1.0);
      
      pdf.addImage(
        backImgData, 
        'PNG', 
        0, 
        0, 
        pageWidth, 
        pageHeight,
        undefined,
        'FAST'
      );
    }
    
    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('PDF Download Error:', error);
    throw error;
  }
};

// Open card PDF in new tab - FIXED
export const openCardPDF = async (frontId, backId, size = "a6") => {
  try {
    const frontCanvas = await captureCard(frontId, 3);
    
    const sizeConfig = PDF_SIZES[size] || PDF_SIZES.a6;
    const pdf = new jsPDF({
      orientation: sizeConfig.width > sizeConfig.height ? "landscape" : "portrait",
      unit: "mm",
      format: [sizeConfig.width, sizeConfig.height],
      compress: false
    });
    
    const imgData = frontCanvas.toDataURL('image/png', 1.0);
    
    pdf.addImage(
      imgData, 
      'PNG', 
      0, 
      0, 
      sizeConfig.width, 
      sizeConfig.height,
      undefined,
      'FAST'
    );
    
    if (backId) {
      pdf.addPage([sizeConfig.width, sizeConfig.height]);
      const backCanvas = await captureCard(backId, 3);
      const backImgData = backCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(backImgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height);
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

// Print card directly - FIXED
export const printCard = async (frontId, backId) => {
  try {
    const frontCanvas = await captureCard(frontId, 2);
    const frontImage = frontCanvas.toDataURL('image/png');
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Accreditation Card</title>
          <style>
            @page { size: auto; margin: 0mm; }
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
              width: 85.6mm; 
              height: 54mm;
              position: relative;
            }
            .card { 
              width: 100%; 
              height: 100%; 
              object-fit: contain;
            }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
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
      const backCanvas = await captureCard(backId, 2);
      const backImage = backCanvas.toDataURL('image/png');
      printWindow.document.body.innerHTML += `
        <div class="card-container">
          <img src="${backImage}" class="card" />
        </div>
      `;
    }
    
    printWindow.document.close();
    
    // Wait for images to load then print
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

// Bulk download multiple cards as ZIP - FIXED
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
        // Create temporary card element with exact styling
        const tempDiv = document.createElement('div');
        tempDiv.id = `temp-card-${acc.id}`;
        tempDiv.style.cssText = `
          width: 320px;
          height: 454px;
          background: white;
          position: absolute;
          left: -9999px;
          top: 0;
          overflow: hidden;
          font-family: Arial, sans-serif;
        `;
        
        // Build card HTML to match your preview exactly
        tempDiv.innerHTML = `
          <div style="width: 100%; height: 100%; position: relative; background: white;">
            <!-- Header -->
            <div style="background: #38bdf8; padding: 12px; text-align: center; color: white;">
              <div style="font-size: 12px; margin-bottom: 4px;">${event?.headerArabic || ''}</div>
              <div style="font-size: 14px; font-weight: bold;">${event?.name || 'EVENT'}</div>
            </div>
            
            <!-- Role Bar -->
            <div style="background: ${getRoleColor(acc.role)}; padding: 8px; text-align: center; color: white; font-weight: bold; font-size: 16px; text-transform: uppercase;">
              ${acc.role || 'PARTICIPANT'}
            </div>
            
            <!-- Main Content -->
            <div style="padding: 16px; display: flex; gap: 16px;">
              <!-- Photo -->
              <div style="width: 100px; height: 120px; flex-shrink: 0;">
                ${acc.photoUrl ? 
                  `<img src="${acc.photoUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />` :
                  `<div style="width: 100%; height: 100%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #64748b;">${acc.firstName?.[0]}${acc.lastName?.[0]}</div>`
                }
              </div>
              
              <!-- Info -->
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
            
            <!-- ID & Badge -->
            <div style="padding: 0 16px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">ID: ${acc.accreditationId || acc.id}</div>
              <div style="font-size: 11px; color: #64748b;">BADGE: ${acc.badgeNumber || 'PENDING'}</div>
            </div>
            
            <!-- QR Code -->
            <div style="padding: 0 16px; margin-bottom: 16px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${acc.accreditationId || acc.id}" style="width: 80px; height: 80px;" />
            </div>
            
            <!-- Footer Logos -->
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
        
        // Capture at high resolution
        const canvas = await html2canvas(tempDiv, {
          scale: 3,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 320,
          height: 454
        });
        
        document.body.removeChild(tempDiv);
        
        // Create PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [sizeConfig.width, sizeConfig.height],
          compress: false
        });
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Fill entire PDF page
        pdf.addImage(imgData, 'PNG', 0, 0, sizeConfig.width, sizeConfig.height, undefined, 'FAST');
        
        // Add to zip
        const pdfBlob = pdf.output('blob');
        const safeName = `${acc.firstName}_${acc.lastName}_${acc.badgeNumber || acc.id}`.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        folder.file(`${safeName}.pdf`, pdfBlob);
        
      } catch (err) {
        console.error(`Failed to process ${acc.firstName} ${acc.lastName}:`, err);
      }
    }
    
    // Download zip
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
