import { differenceInCalendarDays, endOfMonth, endOfQuarter, endOfYear, format, isValid, parse, parseISO, startOfMonth, startOfQuarter, startOfYear, subDays, subMonths, subQuarters, subYears } from 'date-fns';
import type { TimePeriod } from '../types/mortgage';

const BASE_YEAR = 2025;

export function parseDateForColumn(column: string, raw: string): Date | null {
  if (!raw) {
    return null;
  }

  let parsed: Date;
  if (column === 'recommendation_date') {
    parsed = parseISO(raw);
  } else if (column === 'initial_rate_end_date') {
    parsed = parse(raw, 'dd/MM/yyyy', new Date());
  } else {
    parsed = parse(raw, 'dd/MM/yyyy HH:mm', new Date());
    if (!isValid(parsed)) {
      parsed = parse(raw, 'dd/MM/yyyy', new Date());
    }
  }

  return isValid(parsed) ? parsed : null;
}

export function toPeriodKey(period: TimePeriod): string {
  if (period.type !== 'custom') {
    return period.type;
  }
  return `custom:${period.start?.toISOString() ?? 'none'}:${period.end?.toISOString() ?? 'none'}`;
}

export function resolvePeriodBounds(period: TimePeriod, now = new Date(BASE_YEAR, 11, 31)): { start: Date; end: Date } {
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  switch (period.type) {
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'this_half':
      if (now.getMonth() < 6) {
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 5, 30, 23, 59, 59) };
      }
      return { start: new Date(now.getFullYear(), 6, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    case 'custom':
      return {
        start: period.start ?? yearStart,
        end: period.end ?? yearEnd,
      };
    case 'this_year':
    default:
      return { start: yearStart, end: yearEnd };
  }
}

export function priorPeriod(period: TimePeriod, now = new Date(BASE_YEAR, 11, 31)): TimePeriod | null {
  if (period.type === 'this_year') {
    const prev = subYears(now, 1);
    return { type: 'custom', start: startOfYear(prev), end: endOfYear(prev) };
  }
  if (period.type === 'this_half') {
    if (now.getMonth() < 6) {
      return {
        type: 'custom',
        start: new Date(now.getFullYear() - 1, 6, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
      };
    }
    return {
      type: 'custom',
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 5, 30, 23, 59, 59),
    };
  }
  if (period.type === 'this_month') {
    const prev = subMonths(now, 1);
    return { type: 'custom', start: startOfMonth(prev), end: endOfMonth(prev) };
  }
  if (period.type === 'this_quarter') {
    const prev = subQuarters(now, 1);
    return { type: 'custom', start: startOfQuarter(prev), end: endOfQuarter(prev) };
  }
  if (period.type === 'custom' && period.start && period.end) {
    const span = Math.max(1, differenceInCalendarDays(period.end, period.start) + 1);
    const prevEnd = subDays(period.start, 1);
    const prevStart = subDays(prevEnd, span - 1);
    return { type: 'custom', start: prevStart, end: prevEnd };
  }
  return null;
}

export function monthLabel(date: Date): string {
  return format(date, 'MMM');
}

export function monthLabelFromKey(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  return monthLabel(new Date(year, month - 1, 1));
}

