// Local export utilities for Reports and Excel/CSV/PDF (100% offline)
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBDT } from './currency';
import { formatDisplayDate } from './date';

/**
 * Export data array to Excel (.xlsx) file directly in browser
 */
export function exportToExcel(sheets: { sheetName: string; data: any[] }[], filename: string) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export single table data to CSV file
 */
export function exportToCSV(data: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate PDF Report using jsPDF and autoTable (runs 100% locally without external fonts or server)
 */
export function generatePdfReport(options: {
  title: string;
  shopName: string;
  dateRange: string;
  summaryRows: [string, string][];
  tableHead: string[];
  tableBody: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(5, 150, 105); // Emerald
  doc.text(options.shopName, 14, 18);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(options.title, 14, 26);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Period: ${options.dateRange}`, 14, 32);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 37);

  // Summary box
  let startY = 44;
  if (options.summaryRows.length > 0) {
    autoTable(doc, {
      startY,
      theme: 'grid',
      head: [['Metric', 'Amount / Value']],
      body: options.summaryRows,
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'right', cellWidth: 50 }
      }
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Main table
  if (options.tableHead.length > 0 && options.tableBody.length > 0) {
    autoTable(doc, {
      startY,
      theme: 'striped',
      head: [options.tableHead],
      body: options.tableBody,
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });
  }

  doc.save(`${options.filename}.pdf`);
}
