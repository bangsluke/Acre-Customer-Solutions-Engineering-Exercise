import { describe, expect, it } from 'vitest';
import { computeLenderStats, computeMarketStats } from './aggregations';
import { fixtureRows } from '../test/fixtures';

describe('metrics calculations', () => {
  it('computes resubmission and cycle-time metrics', () => {
    const market = computeMarketStats(fixtureRows);
    const halifax = computeLenderStats(fixtureRows, 'Halifax', market);

    expect(market.resubmissionRate).toBeGreaterThan(0);
    expect(halifax.resubmissionRate).toBeGreaterThan(0);
    expect(market.avgDaysToOffer).toBeGreaterThan(0);
  });

  it('guards against invalid ltv outliers in averages', () => {
    const market = computeMarketStats(fixtureRows);
    expect(market.avgLtv).toBeLessThan(1);
  });
});

