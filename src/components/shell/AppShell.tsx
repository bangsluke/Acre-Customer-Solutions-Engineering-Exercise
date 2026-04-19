import { lazy, Suspense, useMemo, useState } from 'react';
import { useDataContext } from '../../context/useDataContext';
import { evaluateLenderInsights } from '../../utils/lenderInsights';
import { computeTypicalLifecycleDays } from '../../utils/funnelMetrics';
import { TimeFilter } from '../shared/TimeFilter';
import { LastUpdatedFooter } from '../shared/LastUpdatedFooter';
import { ViewTabs } from './ViewTabs';

const InternalDashboard = lazy(() =>
  import('../internal/InternalDashboard').then((module) => ({ default: module.InternalDashboard })),
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
const InternalProductAnalysisTab = lazy(() =>
  import('../internal/InternalProductAnalysisTab').then((module) => ({ default: module.InternalProductAnalysisTab })),
);
const InternalDataQualityTab = lazy(() =>
  import('../internal/InternalDataQualityTab').then((module) => ({ default: module.InternalDataQualityTab })),
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
  { id: 'product-analysis', label: 'Product Analysis' },
  { id: 'lender-share', label: 'Lender share' },
  { id: 'risk-ltv', label: 'Risk and LTV' },
  { id: 'trends', label: 'Trends' },
  { id: 'data-quality', label: 'Data Quality' },
];

const LENDER_TABS: Array<{ id: string; label: string; badge?: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'insights', label: 'Insights' },
];

type InternalTabId = 'overview' | 'product-analysis' | 'lender-share' | 'risk-ltv' | 'trends' | 'data-quality';
type LenderTabId = 'overview' | 'performance' | 'pipeline' | 'insights';

function TabContentFallback() {
  return (
    <section className="mt-8 rounded-xl border border-acre-border bg-white p-8 text-acre-muted">
      Loading tab content...
    </section>
  );
}

export function AppShell() {
  const [activeView, setActiveView] = useState<'internal' | 'lender'>('internal');
  const [internalTab, setInternalTab] = useState<InternalTabId>('overview');
  const [lenderTab, setLenderTab] = useState<LenderTabId>('overview');
  const [showTimeFilters, setShowTimeFilters] = useState(true);
  const { status, progress, error, activePeriod, setActivePeriod, periodModel, allRows, selectedLender, setSelectedLender } = useDataContext();

  const lenderNames = periodModel?.lenderStats
    ? [...periodModel.lenderStats.keys()].sort((a, b) => a.localeCompare(b))
    : [];

  const lenderStats = periodModel?.lenderStats?.get(selectedLender) ?? null;
  const alerts = useMemo(
    () => {
      if (!periodModel) {
        return 0;
      }
      return evaluateLenderInsights(
        periodModel.periodData,
        selectedLender,
        periodModel.marketStats,
      ).alertMessages.length;
    },
    [periodModel, selectedLender],
  );
  const lenderTabsWithBadge = LENDER_TABS.map((tab) =>
    tab.id === 'insights' && alerts > 0 ? { ...tab, badge: `${alerts} ${alerts === 1 ? 'alert' : 'alerts'}` } : tab,
  );
  const typicalLifecycleDays = useMemo(() => computeTypicalLifecycleDays(allRows), [allRows]);
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
          <div className="relative sticky top-6 z-20 bg-[#FCFCFB] pb-3 desktop-md:top-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-[#FCFCFB] desktop-md:-top-8 desktop-md:h-8"
            />
            <div className="border-b border-acre-border pb-3">
              <nav className="flex flex-wrap items-end justify-between gap-4 text-lg text-acre-muted" role="tablist" aria-label={`${activeView} dashboard sections`}>
                <div className="flex flex-wrap items-center gap-6">
                  <span className="inline-flex items-center gap-2 pb-2 text-lg font-semibold text-acre-text" aria-hidden="true">
                    <img src="/favicon.svg" alt="" className="h-5 w-5 object-contain" />
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
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{tab.badge}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimeFilters((current) => !current)}
                  aria-expanded={showTimeFilters}
                  aria-controls="time-filter-row"
                  className="inline-flex h-[30px] items-center rounded-md border border-acre-border bg-white px-3 text-xs font-medium text-acre-text transition hover:border-acre-purple-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple"
                >
                  {showTimeFilters ? 'Hide time frame' : 'Show time frame'}
                </button>
              </nav>
            </div>
            <div id="time-filter-row" className={showTimeFilters ? 'block' : 'hidden'}>
              <TimeFilter activePeriod={activePeriod} onChange={setActivePeriod} />
            </div>
          </div>

          <Suspense fallback={<TabContentFallback />}>
            {activeView === 'internal' ? (
              internalTab === 'overview' ? (
                <InternalDashboard
                  stats={periodModel.marketStats}
                  period={activePeriod}
                  periodData={periodModel.periodData}
                  allRows={allRows}
                  typicalLifecycleDays={typicalLifecycleDays}
                />
              ) : internalTab === 'product-analysis' ? (
                <InternalProductAnalysisTab periodData={periodModel.periodData} period={activePeriod} />
              ) : internalTab === 'lender-share' ? (
                <InternalLenderShareTab periodData={periodModel.periodData} period={activePeriod} />
              ) : internalTab === 'risk-ltv' ? (
                <InternalRiskLtvTab periodData={periodModel.periodData} period={activePeriod} allRows={allRows} />
              ) : internalTab === 'trends' ? (
                <InternalTrendsTab periodData={periodModel.periodData} period={activePeriod} allRows={allRows} />
              ) : (
                <InternalDataQualityTab periodData={periodModel.periodData} quality={periodModel.quality} period={activePeriod} />
              )
            ) : lenderTab === 'overview' ? (
              <LenderDashboard
                selectedLender={selectedLender}
                stats={lenderStats}
                marketStats={periodModel.marketStats}
                periodData={periodModel.periodData}
                period={activePeriod}
                typicalLifecycleDays={typicalLifecycleDays}
              />
            ) : lenderTab === 'performance' ? (
              <LenderPerformanceTab
                periodData={periodModel.periodData}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
                period={activePeriod}
                allRows={allRows}
              />
            ) : lenderTab === 'pipeline' ? (
              <LenderPipelineTab
                periodData={periodModel.periodData}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
                period={activePeriod}
                typicalLifecycleDays={typicalLifecycleDays}
              />
            ) : (
              <LenderInsightsTab
                periodData={periodModel.periodData}
                allRows={allRows}
                selectedLender={selectedLender}
                marketStats={periodModel.marketStats}
                period={activePeriod}
              />
            )}
          </Suspense>
          <LastUpdatedFooter />
        </div>
      </div>
    </main>
  );
}

