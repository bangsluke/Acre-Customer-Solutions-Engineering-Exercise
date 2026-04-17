import { describe, expect, it } from 'vitest';
import { computeLenderStats, computeMarketStats, filterByPeriod } from './aggregations';
import { fixtureRows } from '../test/fixtures';

describe('period-aware aggregations', () => {
  it('filters rows by active period', () => {
    const filtered = filterByPeriod(fixtureRows, {
      type: 'custom',
      start: new Date('2025-01-01'),
      end: new Date('2025-01-31'),
    });

    expect(filtered).toHaveLength(2);
  });

  it('computes lender stats from same filtered slice as market stats', () => {
    const filtered = filterByPeriod(fixtureRows, {
      type: 'custom',
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
    });
    const market = computeMarketStats(filtered);
    const halifax = computeLenderStats(filtered, 'Halifax', market);

    expect(halifax.totalCases).toBe(2);
    expect(market.totalCases).toBe(3);
    expect(halifax.marketShare).toBeCloseTo(1, 4);
  });
});

