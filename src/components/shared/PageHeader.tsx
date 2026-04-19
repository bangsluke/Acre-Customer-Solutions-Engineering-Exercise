import { useState } from 'react';
import { AppTooltip } from './AppTooltip';

export function PageHeader({
  title,
  subtitle,
  showScoreExport = false,
  scoreExportTooltip = 'Share this performance report as a PDF - to be added in production',
}: {
  title: string;
  subtitle: string;
  showScoreExport?: boolean;
  scoreExportTooltip?: string;
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-acre-text desktop-md:text-4xl">{title}</h1>
        <p className="mt-2 text-base text-acre-muted desktop-md:text-lg">{subtitle}</p>
      </div>
      <div className="flex items-start gap-2">
        {showScoreExport ? (
          <AppTooltip
            content={scoreExportTooltip}
            wrapperClassName="block"
            panelClassName="right-0 left-auto w-64 translate-x-0"
          >
            <span className="block cursor-not-allowed">
              <button
                type="button"
                disabled
                className="rounded-lg border border-acre-border bg-acre-panel px-4 py-2 text-sm font-medium text-acre-muted"
              >
                Score Export
              </button>
            </span>
          </AppTooltip>
        ) : null}
        <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={showExportMenu}
          onClick={() => setShowExportMenu((current) => !current)}
          className="rounded-lg border border-acre-purple bg-acre-purple px-4 py-2 text-sm font-medium text-white transition hover:border-acre-purple-light hover:bg-acre-purple-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple"
        >
          Export Data
        </button>
        {showExportMenu ? (
          <div className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-lg border border-acre-border bg-white p-2 shadow-lg" role="menu">
            <AppTooltip
              content="Functionality would be implemented in a production app to enable users to use the data for further use cases"
              wrapperClassName="block"
              panelClassName="right-0 left-auto w-64 translate-x-0"
            >
              <span className="block cursor-not-allowed">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md border border-acre-border bg-acre-panel px-3 py-2 text-left text-sm text-acre-muted"
                >
                  Export All Data
                </button>
              </span>
            </AppTooltip>
            <AppTooltip
              content="Functionality would be implemented in a production app to enable users to use the data for further use cases"
              wrapperClassName="block"
              panelClassName="right-0 left-auto w-64 translate-x-0"
            >
              <span className="block cursor-not-allowed">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md border border-acre-border bg-acre-panel px-3 py-2 text-left text-sm text-acre-muted"
                >
                  Export Visible Data
                </button>
              </span>
            </AppTooltip>
          </div>
        ) : null}
        </div>
      </div>
    </header>
  );
}

