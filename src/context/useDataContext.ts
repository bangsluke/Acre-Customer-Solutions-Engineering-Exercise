import { useContext } from 'react';
import { DataContext } from './DataContext';

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used inside DataProvider.');
  }
  return context;
}

