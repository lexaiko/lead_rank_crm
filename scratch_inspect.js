import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({ include: { role: true } });
  console.log('--- ADMINS IN DB ---');
  console.log(admins);

  const csvPath = 'c:\\coding\\TripBwi\\classifier\\Data Leads 2026 - Input Data.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  console.log('\nTotal lines in CSV:', lines.length);
  console.log('Header line:', lines[0]);

  // Analyze distinct STATUS and TAHAPAN values across all rows
  const statusValues = new Set();
  const tahapanValues = new Set();
  const sourceValues = new Set();
  const agensValues = new Set();

  // Simple CSV parser handling quotes
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  lines.slice(1).forEach(l => {
    const parts = parseCSVLine(l);
    if (parts.length >= 7) statusValues.add(parts[6]); // STATUS
    if (parts.length >= 13) tahapanValues.add(parts[12]); // TAHAPAN (STATUS)
    if (parts.length >= 5) sourceValues.add(parts[4]); // SOURCE
    if (parts.length >= 6) agensValues.add(parts[5]); // AGEN
  });

  console.log('\n--- DISTINCT STATUS COLUMN VALUES ---');
  console.log(Array.from(statusValues));

  console.log('\n--- DISTINCT TAHAPAN (STATUS) COLUMN VALUES ---');
  console.log(Array.from(tahapanValues));

  console.log('\n--- DISTINCT SOURCE VALUES ---');
  console.log(Array.from(sourceValues));

  console.log('\n--- DISTINCT AGEN VALUES ---');
  console.log(Array.from(agensValues));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
