/**
 * MyPath AI — Google Calendar Service
 * 
 * Tạo lịch học tự động trên Google Calendar
 * Sử dụng Google Calendar API v3 REST
 */

import type { ScheduleEntry } from '@/types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Tạo một sự kiện trên Google Calendar
 */
async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
    recurrence?: string[];
    colorId?: string;
  }
) {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.startDateTime,
          timeZone: event.timeZone,
        },
        end: {
          dateTime: event.endDateTime,
          timeZone: event.timeZone,
        },
        recurrence: event.recurrence || ['RRULE:FREQ=WEEKLY;COUNT=12'],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 15 },
          ],
        },
        colorId: event.colorId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Lỗi tạo sự kiện: ${error.error?.message || 'Không xác định'}`);
  }

  return response.json();
}

/**
 * Map priority level sang Calendar color ID
 * https://developers.google.com/calendar/api/v3/reference/colors
 */
function getPriorityColorId(priority: string): string {
  switch (priority) {
    case 'high': return '11';    // Red (Tomato)
    case 'medium': return '6';   // Orange (Tangerine)
    case 'low': return '2';      // Green (Sage)
    default: return '1';         // Blue (Lavender)
  }
}

/**
 * Tính ngày bắt đầu tiếp theo cho một ngày trong tuần
 * dayOfWeek: 1=Monday, 7=Sunday
 */
function getNextDateForDay(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sunday, 1=Monday, ...
  
  // Convert our format (1=Monday) to JS format (0=Sunday)
  const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek;
  
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);
  return nextDate;
}

/**
 * Format date + time thành ISO datetime string
 */
function formatDateTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const dt = new Date(date);
  dt.setHours(hours, minutes, 0, 0);
  
  // Format: 2026-08-28T19:00:00+07:00
  const offset = -dt.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMinutes = String(absOffset % 60).padStart(2, '0');
  
  return dt.getFullYear() +
    '-' + String(dt.getMonth() + 1).padStart(2, '0') +
    '-' + String(dt.getDate()).padStart(2, '0') +
    'T' + String(dt.getHours()).padStart(2, '0') +
    ':' + String(dt.getMinutes()).padStart(2, '0') +
    ':00' + sign + offsetHours + ':' + offsetMinutes;
}

/**
 * Tạo toàn bộ lịch học trên Google Calendar
 * Trả về danh sách event IDs
 */
export async function createStudyScheduleOnCalendar(
  accessToken: string,
  schedule: ScheduleEntry[],
  targetCareer: string
): Promise<string[]> {
  const eventIds: string[] = [];
  const timeZone = 'Asia/Ho_Chi_Minh';

  for (const entry of schedule) {
    const nextDate = getNextDateForDay(entry.dayOfWeek);
    const startDateTime = formatDateTime(nextDate, entry.startTime);
    const endDateTime = formatDateTime(nextDate, entry.endTime);

    const event = await createCalendarEvent(accessToken, {
      summary: `📚 MyPath: ${entry.subject}`,
      description: `🎯 Ngành mục tiêu: ${targetCareer}\n📖 Nội dung: ${entry.focusArea}\n⚡ Mức ưu tiên: ${entry.priority === 'high' ? '🔴 Cao' : entry.priority === 'medium' ? '🟠 Trung bình' : '🟡 Thấp'}\n\nTạo bởi MyPath AI`,
      startDateTime,
      endDateTime,
      timeZone,
      recurrence: ['RRULE:FREQ=WEEKLY;COUNT=12'],
      colorId: getPriorityColorId(entry.priority),
    });

    eventIds.push(event.id);
  }

  return eventIds;
}

/**
 * Xóa tất cả sự kiện đã tạo
 */
export async function deleteCalendarEvents(
  accessToken: string,
  eventIds: string[]
): Promise<void> {
  for (const eventId of eventIds) {
    await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }
}
