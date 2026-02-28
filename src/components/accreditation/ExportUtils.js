import * as XLSX from 'xlsx';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { formatDate } from '../../lib/utils';

export const exportToExcel = (data, fileName = "accreditations") => {
  const exportData = data.map(item => ({
    "ID": item.accreditationId || item.id, "Badge Number": item.badgeNumber,
    "First Name": item.firstName, "Last Name": item.lastName, "Email": item.email,
    "Role": item.role, "Club": item.club, "Country": item.nationality,
    "Gender": item.gender, "Status": item.status, "Zone Code": item.zoneCode,
    "Date of Birth": item.dateOfBirth, "Submitted": item.createdAt ? formatDate(item.createdAt) : "",
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accreditations");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportTableToPDF = async (data, columns, title = "Accreditations") => {
  const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
    title: { fontSize: 18, marginBottom: 20, fontWeight: "bold" },
    table: { display: "table", width: "100%", borderStyle: "solid", borderWidth: 1, borderColor: "#bfbfbf" },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#bfbfbf" },
    tableHeader: { backgroundColor: "#f0f0f0", fontWeight: "bold" },
    tableCell: { flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: "#bfbfbf" },
    lastCell: { borderRightWidth: 0 }
  });

  const TableDoc = () => React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, title),
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: [styles.tableRow, styles.tableHeader] },
          columns.map((col, i) => React.createElement(Text, { key: col.key, style: [styles.tableCell, i === columns.length - 1 && styles.lastCell] }, col.header))
        ),
        data.map((row, idx) => React.createElement(View, { key: idx, style: styles.tableRow },
          columns.map((col, i) => React.createElement(Text, { key: `${idx}-${col.key}`, style: [styles.tableCell, i === columns.length - 1 && styles.lastCell] }, 
            col.render ? col.render(row) : row[col.key]
          ))
        ))
      )
    )
  );

  const blob = await pdf(React.createElement(TableDoc)).toBlob();
  saveAs(blob, `${title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
};
