import { useState } from 'react';

function DisabledExportAction({ label }: { label: string }) {
  return (
    <div className="group relative">
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-md border border-acre-border bg-acre-panel px-3 py-2 text-left text-sm text-acre-muted opacity-70"
      >
        {label}
      </button>
      <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-72 rounded-md bg-acre-text px-2 py-1.5 text-xs text-white group-hover:block group-focus-within:block">
        These buttons would be functional in a production grade application for the user to proceed with the data
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-acre-text desktop-md:text-5xl">{title}</h1>
        <p className="mt-2 text-base text-acre-muted desktop-md:text-lg">{subtitle}</p>
      </div>
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
            <DisabledExportAction label="Export All Data" />
            <DisabledExportAction label="Export Screen Data" />
          </div>
        ) : null}
      </div>
    </header>
  );
}

