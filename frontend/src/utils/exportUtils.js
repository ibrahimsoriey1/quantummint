import * as XLSX from 'xlsx';

// CSV Export
export const exportToCSV = (data, filename, headers = null) => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  const csvContent = convertToCSV(data, headers);
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

// Excel Export
export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// JSON Export
export const exportToJSON = (data, filename) => {
  if (!data) {
    throw new Error('No data to export');
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

// PDF Export (requires jsPDF)
export const exportToPDF = async (data, filename, title = 'Report') => {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text(title, 14, 22);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
  
  // Convert data to table format
  const tableData = data.map(item => Object.values(item));
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 118, 210] }
  });
  
  doc.save(`${filename}.pdf`);
};

// Helper function to convert data to CSV
const convertToCSV = (data, headers = null) => {
  if (!data || data.length === 0) return '';
  
  const csvHeaders = headers || Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(csvHeaders.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = csvHeaders.map(header => {
      const value = row[header];
      // Handle values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
};

// Helper function to download file
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

// Format data for export
export const formatDataForExport = (data, fieldMappings = {}) => {
  if (!data || data.length === 0) return [];
  
  return data.map(item => {
    const formattedItem = {};
    
    Object.keys(item).forEach(key => {
      const mappedKey = fieldMappings[key] || key;
      let value = item[key];
      
      // Format dates
      if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        value = new Date(value).toLocaleDateString();
      }
      
      // Format boolean values
      if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }
      
      // Format null/undefined values
      if (value === null || value === undefined) {
        value = '';
      }
      
      formattedItem[mappedKey] = value;
    });
    
    return formattedItem;
  });
};

// Export options for different data types
export const getExportOptions = (dataType) => {
  const baseOptions = [
    { label: 'CSV', value: 'csv', icon: '📊' },
    { label: 'Excel', value: 'excel', icon: '📈' },
    { label: 'JSON', value: 'json', icon: '📄' }
  ];
  
  // Add PDF option for certain data types
  if (['users', 'transactions', 'providers'].includes(dataType)) {
    baseOptions.push({ label: 'PDF', value: 'pdf', icon: '📋' });
  }
  
  return baseOptions;
};





