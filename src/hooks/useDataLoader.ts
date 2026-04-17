import { useEffect, useMemo, useState } from 'react';
import type { LoadStatus, PeriodModel, TimePeriod } from '../types/mortgage';
import { computeAllLenderStats, computePeriodModel } from '../utils/aggregations';
import { parseMortgageCsv } from '../utils/csvParser';
import { toPeriodKey } from '../utils/dateUtils';

interface UseDataLoaderResult {
  status: LoadStatus;
  progress: number;
  datasetReady: boolean;
  activePeriod: TimePeriod;
  setActivePeriod: (period: TimePeriod) => void;
  periodModel: PeriodModel | null;
  error: string | null;
}

function deferComputation(callback: () => void): () => void {
  let timeoutId: number | null = null;
  let idleId: number | null = null;

  if (typeof window.requestIdleCallback === 'function') {
    idleId = window.requestIdleCallback(() => callback(), { timeout: 1000 });
  } else {
    timeoutId = window.setTimeout(() => callback(), 0);
  }

  return () => {
    if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  };
}

export function useDataLoader(csvUrl: string, initialPeriod: TimePeriod): UseDataLoaderResult {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [dataset, setDataset] = useState<PeriodModel['periodData']>([]);
  const [activePeriod, setActivePeriod] = useState(initialPeriod);
  const [periodCache, setPeriodCache] = useState<Map<string, PeriodModel>>(new Map());
  const [quality, setQuality] = useState<PeriodModel['quality']>({
    dateParseFailures: {},
    degradedColumns: [],
    criticalFailure: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('parsing');
    parseMortgageCsv(csvUrl, setProgress)
      .then(({ rows, quality: qualityResult }) => {
        if (cancelled) {
          return;
        }
        setDataset(rows);
        setQuality(qualityResult);
        if (qualityResult.criticalFailure) {
          setError('Critical parsing error in core columns (created_at, lender, or case_status).');
          setStatus('error');
          return;
        }
        const initialModel = computePeriodModel(rows, initialPeriod, qualityResult);
        const key = toPeriodKey(initialPeriod);
        setPeriodCache(new Map([[key, initialModel]]));
        setStatus('internal-ready');
      })
      .catch((parseError) => {
        if (!cancelled) {
          setError(parseError instanceof Error ? parseError.message : 'Failed to parse mortgage CSV.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [csvUrl, initialPeriod]);

  useEffect(() => {
    if (!dataset.length || status === 'parsing' || status === 'error') {
      return;
    }

    const key = toPeriodKey(activePeriod);
    const existing = periodCache.get(key);
    const baseModel = existing ?? computePeriodModel(dataset, activePeriod, quality);
    if (!existing) {
      setPeriodCache((prev) => new Map(prev).set(key, baseModel));
    }

    if (baseModel.lenderStats) {
      setStatus('all-ready');
      return;
    }

    const cancel = deferComputation(() => {
      const lenderStats = computeAllLenderStats(baseModel.periodData, baseModel.marketStats);
      setPeriodCache((prev) => {
        const next = new Map(prev);
        next.set(key, {
          ...baseModel,
          lenderStats,
        });
        return next;
      });
      setStatus('all-ready');
    });

    return cancel;
  }, [activePeriod, dataset, periodCache, quality, status]);

  const periodModel = useMemo(() => {
    return periodCache.get(toPeriodKey(activePeriod)) ?? null;
  }, [activePeriod, periodCache]);

  return {
    status,
    progress,
    datasetReady: dataset.length > 0,
    activePeriod,
    setActivePeriod,
    periodModel,
    error,
  };
}

