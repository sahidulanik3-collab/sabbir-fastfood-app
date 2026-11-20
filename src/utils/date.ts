// Date and time utilities for Asia/Dhaka timezone

export const TIMEZONE = 'Asia/Dhaka';

export function getNowDhaka(): Date {
  // Returns current date object
  return new Date();
}

/**
 * Returns date in "YYYY-MM-DD" format in Asia/Dhaka timezone
 */
export function getDhakaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

/**
 * Returns time in "HH:mm:ss" 24h format in Asia/Dhaka
 */
export function getDhakaTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(date);
}

/**
 * Format date for user display: e.g. "20 Nov 2026, 09:25 PM" or Bengali equivalent
 */
export function formatDisplayDateTime(dateStr: string, timeStr?: string, lang: 'bn' | 'en' = 'bn'): string {
  try {
    const fullIso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T12:00:00`;
    const d = new Date(fullIso);
    
    if (isNaN(d.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };

    if (timeStr) {
      options.hour = 'numeric';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format just the date nicely: e.g. "শুক্রবার, ২০ নভেম্বর ২০২৬"
 */
export function formatDisplayDate(dateStr: string, lang: 'bn' | 'en' = 'bn'): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };

    const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    return dateStr;
  }
}

/**
 * Helper to get date ranges: 'today' | 'yesterday' | '7days' | 'month'
 */
export function getDateRange(rangeType: 'today' | 'yesterday' | '7days' | 'month' | 'all') {
  const today = getDhakaDateString();
  const now = new Date();

  switch (rangeType) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = getDhakaDateString(y);
      return { start: yStr, end: yStr };
    }
    case '7days': {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      return { start: getDhakaDateString(past7), end: today };
    }
    case 'month': {
      const yearMonth = today.slice(0, 7);
      return { start: `${yearMonth}-01`, end: today };
    }
    case 'all':
    default:
      return { start: '2020-01-01', end: today };
  }
}
