/**
 * MyPath AI — Google Sheets Service
 * 
 * Tạo Academic Tracker trên Google Sheets
 * Sử dụng Google Sheets API v4 REST
 */

import type { SubjectPriority } from '@/types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Tạo một Google Sheet mới
 */
async function createSpreadsheet(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const response = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'vi_VN',
      },
      sheets: [
        {
          properties: {
            title: 'Theo dõi học tập',
            gridProperties: {
              rowCount: 50,
              columnCount: 8,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Lỗi tạo Google Sheet: ${error.error?.message || 'Không xác định'}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

/**
 * Ghi dữ liệu vào sheet
 */
async function writeToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
) {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Lỗi ghi dữ liệu: ${error.error?.message || 'Không xác định'}`);
  }

  return response.json();
}

/**
 * Format và tạo bảng theo dõi với formatting
 */
async function formatSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number = 0
) {
  const requests = [
    // Bold header row
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.15, green: 0.23, blue: 0.37 },
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 },
              fontSize: 11,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Auto-resize columns
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 8,
        },
      },
    },
    // Freeze header row
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
  ];

  await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );
}

/**
 * Tạo Academic Tracker hoàn chỉnh trên Google Sheets
 */
export async function createAcademicTracker(
  accessToken: string,
  studentName: string,
  targetCareer: string,
  subjects: SubjectPriority[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Tạo spreadsheet mới
  const title = `MyPath AI - Theo dõi học tập - ${studentName}`;
  const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet(accessToken, title);

  // 2. Ghi header + data
  const priorityText = (p: string) =>
    p === 'high' ? '🔴 Cao' : p === 'medium' ? '🟠 Trung bình' : '🟡 Thấp';

  const headerRow = [
    'STT',
    'Môn học',
    'Mức độ ưu tiên',
    'Điểm mục tiêu',
    'Lý do',
    'Tiến độ (%)',
    'Ghi chú',
    'Cập nhật lần cuối',
  ];

  const dataRows = subjects.map((subject, index) => [
    index + 1,
    subject.name,
    priorityText(subject.priority),
    subject.targetGrade,
    subject.reason,
    subject.currentProgress,
    '',
    new Date().toLocaleDateString('vi-VN'),
  ]);

  // Thêm thông tin tổng quan
  const summaryRows = [
    [],
    ['📊 THÔNG TIN TỔNG QUAN'],
    ['Ngành mục tiêu:', targetCareer],
    ['Học sinh:', studentName],
    ['Ngày tạo:', new Date().toLocaleDateString('vi-VN')],
    ['Tạo bởi:', 'MyPath AI'],
    [],
    ['💡 Hướng dẫn:'],
    ['- Cập nhật tiến độ hàng tuần'],
    ['- Ghi chú những điểm cần cải thiện'],
    ['- Điều chỉnh mục tiêu khi cần thiết'],
  ];

  const allRows = [headerRow, ...dataRows, ...summaryRows];

  await writeToSheet(
    accessToken,
    spreadsheetId,
    'Theo dõi học tập!A1',
    allRows as (string | number)[][]
  );

  // 3. Format sheet
  await formatSheet(accessToken, spreadsheetId);

  return { spreadsheetId, spreadsheetUrl };
}
