import XLSX from 'xlsx';

const workbook = XLSX.readFile('./PASTELES KADMIEL 2026.xlsx');

const sheetsToDump = ['Pasteles Clásicos', 'Pasteles Gourmet', 'Tres Leches Clásicos', 'Tres Leches Premium'];

sheetsToDump.forEach(name => {
  console.log(`\n=================== SHEET: ${name} ===================`);
  const ws = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  rows.slice(0, 25).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
});
