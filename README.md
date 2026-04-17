# Acre Lender Dashboard

Embedded React + TypeScript dashboard for Acre’s CSE challenge.  
Two audiences are supported in one demo shell:

- Internal dashboard (market-wide analytics)
- Lender dashboard (selected lender vs anonymised market)

## Getting Started

### Prerequisites

- Node 20+
- npm 10+

### Install

```bash
npm install
```

### Data file

Place `mortgage.csv` into `public/`:

```text
public/mortgage.csv
```

The file is intentionally ignored in git.

### Run locally

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

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

