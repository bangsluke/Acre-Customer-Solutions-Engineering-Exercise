import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoadStatus, PeriodModel, TimePeriod } from '../types/mortgage';
import { useDataLoader } from '../hooks/useDataLoader';
import { DEFAULT_PERIOD, getCsvUrl } from '../utils/constants';
import { pickDefaultLender } from '../utils/aggregations';

interface DataContextValue {
  status: LoadStatus;
  progress: number;
  activePeriod: TimePeriod;
  setActivePeriod: (period: TimePeriod) => void;
  periodModel: PeriodModel | null;
  selectedLender: string;
  setSelectedLender: (lender: string) => void;
  error: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const {
    status,
    progress,
    activePeriod,
    setActivePeriod,
    periodModel,
    error,
  } = useDataLoader(getCsvUrl(), DEFAULT_PERIOD);

  const [selectedLender, setSelectedLender] = useState('');

  useEffect(() => {
    if (!periodModel?.periodData.length) {
      return;
    }
    const defaultLender = pickDefaultLender(periodModel.periodData);
    if (!selectedLender || !periodModel.periodData.some((item) => item.lender === selectedLender)) {
      setSelectedLender(defaultLender);
    }
  }, [periodModel, selectedLender]);

  const value: DataContextValue = {
    status,
    progress,
    activePeriod,
    setActivePeriod,
    periodModel,
    selectedLender,
    setSelectedLender,
    error,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export { DataContext };

