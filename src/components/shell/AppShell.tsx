import { lazy, Suspense, useMemo, useState } from 'react';
import { useDataContext } from '../../context/useDataContext';
import { TimeFilter } from '../shared/TimeFilter';
import { ViewTabs } from './ViewTabs';
import type { MortgageCase } from '../../types/mortgage';

const InternalDashboard = lazy(() =>
  import('../internal/InternalDashboard').then((module) => ({ default: module.InternalDashboard })),
);
const InternalPipelineTab = lazy(() =>
  import('../internal/InternalPipelineTab').then((module) => ({ default: module.InternalPipelineTab })),
);
const InternalLenderShareTab = lazy(() =>
  import('../internal/InternalLenderShareTab').then((module) => ({ default: module.InternalLenderShareTab })),
);
const InternalRiskLtvTab = lazy(() =>
  import('../internal/InternalRiskLtvTab').then((module) => ({ default: module.InternalRiskLtvTab })),
);
const InternalTrendsTab = lazy(() =>
  import('../internal/InternalTrendsTab').then((module) => ({ default: module.InternalTrendsTab })),
);
const LenderDashboard = lazy(() =>
  import('../lender/LenderDashboard').then((module) => ({ default: module.LenderDashboard })),
);
const LenderPerformanceTab = lazy(() =>
  import('../lender/LenderPerformanceTab').then((module) => ({ default: module.LenderPerformanceTab })),
);
const LenderPipelineTab = lazy(() =>
  import('../lender/LenderPipelineTab').then((module) => ({ default: module.LenderPipelineTab })),
);
const LenderInsightsTab = lazy(() =>
  import('../lender/LenderInsightsTab').then((module) => ({ default: module.LenderInsightsTab })),
);

const INTERNAL_TABS: Array<{ id: string; label: string; badge?: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'lender-share', label: 'Lender share' },
  { id: 'risk-ltv', label: 'Risk and LTV' },
  { id: 'trends', label: 'Trends' },
];

const LENDER_TABS: Array<{ id: string; label: string; badge?: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'insights', label: 'Insights' },
];

type InternalTabId = 'overview' | 'pipeline' | 'lender-share' | 'risk-ltv' | 'trends';
type LenderTabId = 'overview' | 'performance' | 'pipeline' | 'insights';

function TabContentFallback() {
  return (
    <section className="mt-8 rounded-xl border border-acre-border bg-white p-8 text-acre-muted">
      Loading tab content...
    </section>
  );
}

function insightAlertCount(periodData: MortgageCase[], selectedLender: string, marketAvgDaysToOffer: number, marketStalledRate: number) {
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (!lenderRows.length) {
    return 0;
  }
  const now = new Date(2025, 11, 31);
  const submitted = lenderRows.filter((row) => row.caseStatus === 'APPLICATION_SUBMITTED');
  const stalled = submitted.filter((row) => {
    const start = row.lastSubmittedDate ?? row.firstSubmittedDate;
    if (!start) {
      return false;
    }
    const days = Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000));
    return days > marketAvgDaysToOffer;
  });
  const lenderStalledRate = submitted.length ? stalled.length / submitted.length : 0;

  const lenderOfferSamples = lenderRows
    .map((row) => {
      if (!row.firstSubmittedDate || !row.firstOfferDate) {
        return null;
      }
      return Math.max(0, Math.round((row.firstOfferDate.getTime() - row.firstSubmittedDate.getTime()) / 86_400_000));
    })
    .filter((value): value is number => value !== null);
  const lenderAvgOfferDays = lenderOfferSamples.length
    ? lenderOfferSamples.reduce((sum, value) => sum + value, 0) / lenderOfferSamples.length
    : 0;

  const lenderValidLtv = lenderRows
    .map((row) => row.ltv)
    .filter((value): value is number => value !== null && value >= 0 && value <= 1.5);
  const marketValidLtv = periodData
    .map((row) => row.ltv)
    .filter((value): value is number => value !== null && value >= 0 && value <= 1.5);
  const lenderHighLtv = lenderValidLtv.length
    ? lenderValidLtv.filter((value) => value >= 0.85).length / lenderValidLtv.length
    : 0;
  const marketHighLtv = marketValidLtv.length
    ? marketValidLtv.filter((value) => value >= 0.85).length / marketValidLtv.length
    : 0;

  let alerts = 0;
  if (lenderStalledRate > marketStalledRate * 1.5) alerts += 1;
  if (lenderAvgOfferDays > marketAvgDaysToOffer) alerts += 1;
  if (lenderHighLtv > marketHighLtv + 0.05) alerts += 1;
  return alerts;
}

export function AppShell() {
  const [activeView, setActiveView] = useState<'internal' | 'lender'>('internal');
  const [internalTab, setInternalTab] = useState<InternalTabId>('overview');
  const [lenderTab, setLenderTab] = useState<LenderTabId>('overview');
  const { status, progress, error, activePeriod, setActivePeriod, periodModel, selectedLender, setSelectedLender } = useDataContext();

  const lenderNames = periodModel?.lenderStats
    ? [...periodModel.lenderStats.keys()].sort((a, b) => a.localeCompare(b))
    : [];

  const lenderStats = periodModel?.lenderStats?.get(selectedLender) ?? null;
  const alerts = useMemo(
    () => {
      if (!periodModel) {
        return 0;
      }
      return insightAlertCount(
        periodModel.periodData,
        selectedLender,
        periodModel.marketStats.avgDaysToOffer,
        periodModel.marketStats.stalledSubmittedRate,
      );
    },
    [periodModel, selectedLender],
  );
  const lenderTabsWithBadge = LENDER_TABS.map((tab) =>
    tab.id === 'insights' && alerts > 0 ? { ...tab, badge: `${alerts} alerts` } : tab,
  );
  const subTabs = activeView === 'internal' ? INTERNAL_TABS : lenderTabsWithBadge;
  const activeSubTab = activeView === 'internal' ? internalTab : lenderTab;

  if (status === 'parsing' || status === 'idle') {
    return (
      <main className="mx-auto min-h-screen max-w-[1220px] p-8">
        <div className="rounded-xl border border-acre-border bg-white p-10">
          <h1 className="text-4xl font-semibold text-acre-text">Loading market data...</h1>
          <p className="mt-4 text-acre-muted">Preparing Acre Internal and Lender dashboard</p>
          <div className="mt-6 h-3 rounded-full bg-acre-panel">
            <div className="h-3 rounded-full bg-acre-purple transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-acre-muted">{progress}% parsed</p>
        </div>
      </main>
    );
  }

  if (status === 'error' || !periodModel) {
    return (
      <main className="mx-auto min-h-screen max-w-[1220px] p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">
          {error ?? 'Failed to load mortgage data.'}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full">
      <div className="grid min-h-screen grid-cols-1 desktop-md:grid-cols-[240px_1fr]">
        <aside className="h-screen border-r border-acre-border bg-acre-panel p-4 desktop-md:sticky desktop-md:top-0">
          <ViewTabs active={activeView} onChange={setActiveView} />
          {activeView === 'lender' ? (
            <section className="mt-4 rounded-xl border border-acre-border bg-white p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-acre-muted">Lender</p>
              <select
                className="w-full rounded-lg border border-acre-border bg-white px-3 py-2 text-sm text-acre-text"
                value={selectedLender}
                onChange={(event) => setSelectedLender(event.target.value)}
                aria-label="Select lender"
              >
                {lenderNames.map((lender) => (
                  <option key={lender} value={lender}>
                    {lender}
                  </option>
                ))}
              </select>
            </section>
          ) : null}
        </aside>

        <div className="p-6 desktop-md:p-8">
          <div className="border-b border-acre-border pb-3">
            <nav className="flex flex-wrap items-center gap-6 text-lg text-acre-muted" role="tablist" aria-label={`${activeView} dashboard sections`}>
              <span className="font-semibold text-acre-text" aria-hidden="true">
                {activeView === 'internal' ? 'Internal' : 'Lender'}
              </span>
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={tab.id === activeSubTab}
                  onClick={() => {
                    if (activeView === 'internal') {
                      setInternalTab(tab.id as InternalTabId);
                    } else {
                      setLenderTab(tab.id as LenderTabId);
                    }
                  }}
                  className={`pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple ${
                    tab.id === activeSubTab ? 'border-b-2 border-acre-purple text-acre-purple' : ''
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{tab.badge}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>

          <TimeFilter activePeriod={activePeriod} onChange={setActivePeriod} />

          <Suspense fallback={<TabContentFallback />}>
            {activeView === 'internal' ? (
              internalTab === 'overview' ? (
                <InternalDashboard stats={periodModel.marketStats} />
              ) : internalTab === 'pipeline' ? (
                <InternalPipelineTab stats={periodModel.marketStats} periodData={periodModel.periodData} />
              ) : internalTab === 'lender-share' ? (
                <InternalLenderShareTab periodData={periodModel.periodData} />
              ) : internalTab === 'risk-ltv' ? (
                <InternalRiskLtvTab periodData={periodModel.periodData} quality={periodModel.quality} />
              ) : (
                <InternalTrendsTab periodData={periodModel.periodData} />
              )
            ) : lenderTab === 'overview' ? (
              <LenderDashboard
                selectedLender={selectedLender}
                stats={lenderStats}
                marketStats={periodModel.marketStats}
              />
            ) : lenderTab === 'performance' ? (
              <LenderPerformanceTab
                periodData={periodModel.periodData}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
              />
            ) : lenderTab === 'pipeline' ? (
              <LenderPipelineTab
                periodData={periodModel.periodData}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
              />
            ) : (
              <LenderInsightsTab
                periodData={periodModel.periodData}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
              />
            )}
          </Suspense>
        </div>
      </div>
    </main>
  );
}

