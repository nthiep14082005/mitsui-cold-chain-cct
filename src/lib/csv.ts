import crypto from 'crypto';
import { MonthlyStatement } from '@/types/claim-billing-kpi';
import { TempReading } from '@/types/transport-temp';

/**
 * FR-26 & Section 6.2: Parses logger CSV upload while preserving exact raw temperature values
 * (no rounding or resampling) and marking source = 'CSV'.
 * Supports columns: loggerId,timestamp,tempC,humidityPct (comma or semicolon separated).
 */
export function parseLoggerCsv(
  csvText: string,
  defaultLoggerId?: string
): { readings: TempReading[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { readings: [], errors: ['File CSV trống.'] };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const readings: TempReading[] = [];
  const errors: string[] = [];
  const ingestedAt = new Date().toISOString();

  const startIdx = lines[0].toLowerCase().includes('temp') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) {
      errors.push(`Dòng ${i + 1}: thiếu cột dữ liệu.`);
      continue;
    }

    let loggerId = cols[0];
    let timestamp = cols[1];
    let tempStr = cols[2];
    let humStr = cols[3] ?? '90';

    // Support 3-column CSV (timestamp,tempC,humidityPct) when defaultLoggerId provided
    if (defaultLoggerId && /^\d{4}-\d{2}-\d{2}/.test(cols[0])) {
      loggerId = defaultLoggerId;
      timestamp = cols[0];
      tempStr = cols[1];
      humStr = cols[2] ?? '90';
    }

    const tempC = Number(tempStr);
    const humidityPct = Number(humStr);
    const parsedTime = new Date(timestamp);

    if (!loggerId || Number.isNaN(tempC) || Number.isNaN(parsedTime.getTime())) {
      errors.push(`Dòng ${i + 1}: dữ liệu không hợp lệ ("${lines[i]}").`);
      continue;
    }

    readings.push({
      id: `READ-CSV-${Date.now()}-${i}-${crypto.randomBytes(2).toString('hex')}`,
      loggerId,
      timestamp: parsedTime.toISOString(),
      tempC, // Raw unrounded value per Section 6.2
      humidityPct: Number.isNaN(humidityPct) ? 90 : humidityPct,
      source: 'CSV',
      ingestedAt,
    });
  }

  return { readings, errors };
}

function escapeCsvCell(val: string | number): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * FR-43: Exports a monthly billing statement to Excel-compatible UTF-8 BOM CSV.
 */
export function generateStatementCsv(statement: MonthlyStatement, orgName: string): string {
  const rows: Array<Array<string | number>> = [
    ['MITSUI COLD CHAIN CONTROL TOWER - BANG KE DOI SOAT THANG'],
    ['Ma bang ke', statement.code],
    ['Ky doi soat', statement.month],
    ['Loai', statement.statementType === 'KHACH_HANG' ? 'Khach hang B2B' : 'Doi tac dich vu'],
    ['Don vi', orgName],
    ['Trang thai', statement.status === 'DA_XAC_NHAN' ? 'Da xac nhan' : 'Cho xac nhan'],
    ['San luong cam ket (kg)', statement.committedKg ?? ''],
    ['San luong thuc giao / thuc hien (kg)', statement.actualDeliveredKg],
    ['San luong tinh cuoc (kg)', statement.billableKg],
    ['Don gia (VND/kg)', statement.unitPriceVndPerKg],
    ['Thanh tien truoc giam tru (VND)', statement.grossAmountVnd],
    ['Giam tru / Phat SLA (VND)', statement.deductionOrPenaltyVnd],
    ['Tong thanh toan rong (VND)', statement.netAmountVnd],
    [],
    ['STT', 'Dien giai', 'Ma tham chieu', 'Khoi luong (kg)', 'Don gia (VND/kg)', 'Thanh tien (VND)'],
    ...statement.lineItems.map((item, idx) => [
      idx + 1,
      item.description,
      item.refCode ?? '',
      item.quantityKg,
      item.rateVnd,
      item.amountVnd,
    ]),
  ];

  const csvBody = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  return '\uFEFF' + csvBody;
}
