import type { TimePeriod } from '../types/mortgage';

export function getTimeFrameSuffix(period: TimePeriod): string {
  switch (period.type) {
    case 'this_half':
      return 'THIS HALF';
    case 'this_quarter':
      return 'THIS QUARTER';
    case 'this_month':
      return 'THIS MONTH';
    case 'custom':
      return 'CUSTOM RANGE';
    case 'this_year':
    default:
      return 'THIS YEAR';
  }
}

export function getPeriodSubtitle(period: TimePeriod): string {
  switch (period.type) {
    case 'this_half':
      return 'Period: This half';
    case 'this_quarter':
      return 'Period: This quarter';
    case 'this_month':
      return 'Period: This month';
    case 'custom':
      return 'Period: Custom range';
    case 'this_year':
    default:
      return 'Period: This year';
  }
}

export function withTimeFrameLabel(label: string, period: TimePeriod): string {
  return `${label.toUpperCase()} ${getTimeFrameSuffix(period)}`;
}
