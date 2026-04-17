import { endOfMonth, endOfQuarter, endOfYear, format, isValid, parse, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths, subQuarters } from 'date-fns';
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
  if (period.type === 'this_month') {
    const prev = subMonths(now, 1);
    return { type: 'custom', start: startOfMonth(prev), end: endOfMonth(prev) };
  }
  if (period.type === 'this_quarter') {
    const prev = subQuarters(now, 1);
    return { type: 'custom', start: startOfQuarter(prev), end: endOfQuarter(prev) };
  }
  return null;
}

export function monthLabel(date: Date): string {
  return format(date, 'MMM');
}

