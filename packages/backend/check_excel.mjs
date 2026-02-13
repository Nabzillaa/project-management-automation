import XLSX from 'xlsx';
import { readFileSync } from 'fs';

const buffer = readFileSync('/Users/nabilsabih/Downloads/Project Planner.xlsx');
const workbook = XLSX.read(buffer, { type: 'buffer' });

console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log('\nSheet:', sheetName);
  console.log('Rows:', data.length);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('\nFirst row:', JSON.stringify(data[0], null, 2));
  }
});
