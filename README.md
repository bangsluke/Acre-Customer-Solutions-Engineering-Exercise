# Acre Lender Dashboard

Embedded React + TypeScript dashboard for Acre’s CSE challenge.  
Two audiences are supported in one demo shell:

- Internal dashboard (market-wide analytics)
- Lender dashboard (selected lender vs anonymised market)

## Getting Started (Beginner-Friendly)

Follow these steps in order. You only need to do setup once.

### 1) Install required software first

You need:

- **Node.js (LTS version)** - this runs the app tools
- **npm** - this installs app packages (it is included with Node.js)

If you do not have Node.js yet:

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version
3. Run the installer with default options
4. Restart your terminal after install

Recommended minimum versions:

- Node 20+
- npm 10+

To check versions, run:

```bash
node -v
npm -v
```

### 2) Before you begin

- Open a terminal (PowerShell, Command Prompt, or Terminal)
- Move to this project folder
- Make sure your data file exists at:

```text
public/mortgage.csv
```

### 3) Install the app dependencies

From the project folder, run:

```bash
npm install
```

What this does: downloads everything the app needs to run.

### 4) Start the app in development mode

Run:

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### 5) Best performance check (recommended)

For the smoothest and most realistic experience, use a production preview:

1. Build the app:

```bash
npm run build
```

2. Start preview mode:

```bash
npm run preview
```

3. Open the preview URL shown in the terminal (usually [http://localhost:4173](http://localhost:4173))
4. Open that URL in an **incognito/private window** for best performance (avoids extension/cache interference)

### Quick Troubleshooting

- **`npm` or `node` not found:** reinstall Node.js LTS, then restart terminal
- **Page does not load:** confirm the terminal shows the app is running and use the exact URL printed
- **Port already in use:** stop other local apps using the same port, then run command again
- **No dashboard data shown:** confirm `public/mortgage.csv` exists and is named exactly `mortgage.csv`

## Scripts

- `npm run dev` - start local dev server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest test suite
- `npm run build` - typecheck and production build
- `npm run preview` - preview production build

## Architecture

### UI and navigation

- Single-page embedded layout (no router)
- Top-level view toggle: Internal / Lender
- Sub-tabs per view (all wired and functional)
- Shared time filter driving both dashboards

### Data flow

- CSV parsed client-side via PapaParse
- Typed mapping into `MortgageCase`
- Single active period model (`filterByPeriod`)
- Market and lender metrics computed from the same period slice
- Deferred lender aggregation with idle callback fallback

### Privacy boundary

Lender-facing tabs show only:

- selected lender values
- anonymised market aggregates

No competitor-specific lender values are exposed in lender views.

## Design and product decisions

- Desktop-first dashboard layout
- Internal + lender views shown together for interview demo convenience
- No auth implemented (assumed handled by host platform)
- Progressive loading:
  - parse and internal metrics first
  - lender metrics shortly after

## Data quality handling

- Explicit date parsing by column formats
- Parse quality tracking and degradation warnings
- LTV outlier exclusions (`> 1.5`) from risk calculations
- Null/zero financial values guarded in metrics
- Internal data quality panels on risk-oriented views

## Trade-offs

- Client-side parsing is acceptable for challenge scope, not ideal for production at scale
- Recharts adds bundle size; heavy tab content is lazy-loaded
- Some advanced benchmark formulas are simplified but consistent and test-covered

## Scaling beyond demo volumes

### Why browser CSV parsing slows beyond ~50k rows

- Parsing, type coercion, and aggregation all compete with rendering on the same client device.
- Large in-memory row arrays increase GC churn and UI jank (especially when switching tabs/time filters).
- Network transfer is also inefficient: every user downloads the full dataset even when viewing one lender or one period.
- Past ~50k rows, "time to interactive" and filter response become inconsistent across typical laptop hardware.

### Production architecture equivalent

- Store normalized case data in a warehouse + OLTP combination (for example Postgres for operational reads, BigQuery for heavy analytics).
- Expose an API layer that returns pre-filtered, paginated, and aggregated results for each dashboard panel.
- Move expensive metric computation server-side (SQL/materialized views or scheduled aggregate jobs), returning only chart/KPI payloads to the UI.
- Keep the frontend focused on presentation, local state, and light client-side derivations.

### Incremental loading model

- Load shell metadata first (time ranges, lender list, latest data timestamp).
- Fetch KPI summaries and above-the-fold cards next.
- Fetch heavier chart/table payloads per tab on demand (or in low-priority background prefetch).
- Use cursor/window-based API pagination for long case tables (for example stalled-case lists), not full dataset hydration.

### Handling the 53% blank-lender issue at ingestion

- Validate lender fields at ingestion and route missing/invalid lender rows to a quarantine stream with reason codes.
- Preserve raw values for auditability, but publish a canonicalized lender dimension key (`unknown`, `blank`, mapped aliases).
- Enrich via deterministic remediation rules (lender-id joins, product metadata, historical lender mapping) before analytics publication.
- Track blank-lender rate as a data quality SLI with alert thresholds; block lender-level benchmark publication when confidence is below threshold.

## Testing

Coverage includes:

- CSV parsing and coercion
- Period-aware aggregation behavior
- Key metric formulas (resubmission, cycle-time, etc.)
- Data loader progressive state transitions
- Shell smoke tests

Run with:

```bash
npm run test
```

## Accessibility and UX safeguards

- Tab controls expose ARIA semantics (`tablist` / `tab`) and selected state.
- Time filters expose pressed state for assistive technologies.
- Key chart containers provide descriptive `aria-label` attributes.
- All major tabs include explicit empty states for narrow filters or missing lender slices.

