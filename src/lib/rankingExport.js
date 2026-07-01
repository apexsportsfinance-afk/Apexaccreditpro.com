/**
 * SWIMMERS RANKING — export a ranking table to XLSX / CSV / PDF.
 * Reuses the app's export stack: @e965/xlsx, jspdf(+autotable), file-saver
 * (same choices as src/lib/exportUtils.js). Heavy libs are dynamically
 * imported so they only load when someone actually exports.
 */
import * as XLSX from '@e965/xlsx';
import { saveAs } from 'file-saver';

const sanitize = (s) => String(s || '').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();

/** Human title for an event, e.g. "Girls 12 · 200m LC Freestyle". */
export function eventTitle(f) {
  const g = f.gender === 'F' ? 'Girls' : f.gender === 'M' ? 'Boys' : '';
  return `${g} ${f.ageAtSwim} · ${f.distance}m ${f.courseType} ${f.stroke}`.trim();
}

/** Rows → the flat records both the on-screen table and the exports share. */
export function toRecords(rows) {
  return (rows || []).map((r) => ({
    Rank: r.rank_position,
    Swimmer: r.swimmer_name || '—',
    Club: r.club_name || '—',
    Age: r.age_at_swim,
    Time: r.best_time_display || '—',
    'WA Points': r.wa_points ?? '',
    Meet: r.meet_name || '',
    Date: r.swim_date || '',
    Season: r.season || '',
  }));
}

function baseName(filters) {
  const dateStr = new Date().toISOString().split('T')[0];
  return `ranking_${sanitize(eventTitle(filters))}_${dateStr}`;
}

export function exportXlsx(rows, filters) {
  const ws = XLSX.utils.json_to_sheet(toRecords(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${baseName(filters)}.xlsx`);
}

export function exportCsv(rows, filters) {
  const ws = XLSX.utils.json_to_sheet(toRecords(rows));
  const csv = XLSX.utils.sheet_to_csv(ws);
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${baseName(filters)}.csv`);
}

export async function exportPdf(rows, filters) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF('portrait');
  doc.setFontSize(16);
  doc.text(eventTitle(filters), 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString()} · ${rows.length} swimmer(s)`, 14, 27);

  const records = toRecords(rows);
  autoTable(doc, {
    startY: 33,
    head: [['Rank', 'Swimmer', 'Club', 'Age', 'Time', 'WA Pts']],
    body: records.map((r) => [r.Rank, r.Swimmer, r.Club, r.Age, r.Time, r['WA Points']]),
    theme: 'grid',
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 9 },
  });
  doc.save(`${baseName(filters)}.pdf`);
}

export function exportRanking(format, rows, filters) {
  if (format === 'csv') return exportCsv(rows, filters);
  if (format === 'pdf') return exportPdf(rows, filters);
  return exportXlsx(rows, filters);
}
