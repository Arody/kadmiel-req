import XLSX from 'xlsx';

const excelPath = './PASTELES KADMIEL 2026.xlsx';
const workbook = XLSX.readFile(excelPath);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=================== SHEET: ${sheetName} ===================`);
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  rows.slice(0, 40).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
});
