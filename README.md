# Acre Lender Dashboard

Embedded React + TypeScript dashboard for Acre's Customer Solutions Engineer challenge.

<p align="center">
  <img src="https://bangsluke-assets.netlify.app/images/projects/Acre-Dashboard.png" alt="Acre Lender Dashboard Screenshot" height="400"/>
</p>

The application supports two audiences:

- Internal dashboard for Acre teams to review platform-wide performance.
- Lender dashboard for a selected lender, benchmarked against anonymised market aggregates.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Getting Started](#getting-started)
  - [1) Install required software](#1-install-required-software)
  - [2) Confirm project data](#2-confirm-project-data)
  - [3) Install dependencies](#3-install-dependencies)
  - [4) Recommended production preview](#4-recommended-production-preview)
  - [Troubleshooting](#troubleshooting)
- [Scripts](#scripts)
- [Solution Overview](#solution-overview)
  - [Initial Assumptions](#initial-assumptions)
  - [Audiences and dashboard split](#audiences-and-dashboard-split)
  - [Core architecture](#core-architecture)
  - [Privacy boundary](#privacy-boundary)
- [Design Decisions and Trade-offs](#design-decisions-and-trade-offs)
  - [Why this structure](#why-this-structure)
  - [Trade-offs](#trade-offs)
- [Process](#process)
- [Data Quality](#data-quality)
  - [Current handling in this implementation](#current-handling-in-this-implementation)
  - [Known data limitations](#known-data-limitations)
  - [Pipeline stage grouping assumptions](#pipeline-stage-grouping-assumptions)
- [Further Ideation](#further-ideation)
  - [Product and UX priorities](#product-and-ux-priorities)
  - [Potential feature extensions](#potential-feature-extensions)
  - [Data and modelling enhancements desired](#data-and-modelling-enhancements-desired)
- [User Stories](#user-stories)
  - [Acre Internal Users](#acre-internal-users)
  - [Lender Partners](#lender-partners)
- [Testing](#testing)

## Getting Started

### 1) Install required software

You need:

- Node.js (LTS)
- npm (included with Node.js)

If you do not have Node.js yet:

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version
3. Run the installer with default options
4. Restart your terminal after install

Recommended minimum versions:

- Node 20+
- npm 10+

Check versions:

```bash
node -v
npm -v
```

### 2) Confirm project data

Ensure this file exists:

```text
public/mortgage.csv
```

### 3) Install dependencies

```bash
npm install
```

### 4) Recommended production preview

```bash
npm run build
npm run preview
```

Open the preview URL shown in terminal (usually [http://localhost:4173](http://localhost:4173)). It is recommended to open this in an incognito/private window for best performance (avoids extension/cache interference).

### Troubleshooting

- `node` or `npm` not found: reinstall Node.js LTS and restart terminal.
- App does not load: confirm server is running and use terminal URL.
- Port conflict: stop the other app on that port and rerun.
- No data visible: confirm `public/mortgage.csv` exists and filename matches exactly.

## Scripts

- `npm run dev` - start local development server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest tests
- `npm run build` - type-check and build production bundle
- `npm run preview` - run production preview server

## Solution Overview

### Initial Assumptions

I interpreted the task as two separate dashboards, one (a) for internal teams to understand the global activity data of lenders and the second screen (b) as representative of a client dashboard. It was assumed that clients would view (b) and not be able to see (a), and that internal acre users would view (a) and could view (b) to see specific lender data if required.

I have built this tool as a screen developed within the context of an application. As such, the tool does not have a header and footer, nor a proper sidebar for navigation as it would be expected to be embedded within an existing application - one internal and one external. Instead there is just a simple sidebar to switch between the two views.

For both dashboards, I did not add a login feature as I view this screen as page reached within the internal/external application following authentication. However to demo the functionality of the dashboard across multiple lenders, I have provided a dropdown to select the lender partner.

I also assumed that lender partners do not have access to seeing the lender data of other partners within Acre's system. Acre may provide a market average, but won't expose individual lender data to other partners. If this assumption is incorrect, then the content of the lender dashboard could be updated to have additional insights such as showing the lender who most of their clients are leaving to or coming from to allow them to investigate and improve their own performance.

The screen is designed and developed for desktop viewports, with limited scaling between small, medium and large desktop screen sizes given that we aren't hosting the site and will just run it locally.

From a simplicity viewpoint, the app is built as an SPA (Single Page Application) and lender selection is stored in state rather than by redirecting to a new page. If deep linking becomes important (e.g. sharing a link to "Halifax's Q2 performance"), routing would need to be introduced. For a prototype screen within a larger app, this is a premature optimisation.

For the time frames, "This half" represents the last 6 months of 2025, "This quarter" represents the last 3 months and "This month" represents the last month. In the production app, these would be dynamic and would be based on the current date.

### Audiences and dashboard split

- Internal view: global platform activity and benchmark metrics.
- Lender view: selected lender performance versus market benchmarks.

### Core architecture

- React + TypeScript single-page app.
- CSV is parsed client-side and mapped into typed domain objects.
- Shared time filtering drives both dashboards.
- Lender-level metrics are deferred to keep initial load responsive.

### Privacy boundary

Lender-facing pages show:

- Selected lender metrics.
- Anonymised market averages.

No named competitor-specific lender metrics are exposed in lender views.

## Design Decisions and Trade-offs

### Why this structure

The structure is designed to answer the highest-value questions for both audiences with minimal friction. For Acre internal users, the priority is a clear market-wide view of volume, funnel progression, and benchmark performance so they can identify platform trends and intervention points quickly. For lender users, the priority is a focused “market vs me” experience that highlights where they over- or under-index against anonymised market baselines.

I prioritised conversion velocity, pipeline progression, and comparative benchmark metrics because they are the strongest practical indicators of operational efficiency and commercial opportunity in mortgage journeys. This also keeps the dashboard decision-oriented: users can move from insight to action (for example, identifying stalled pipeline stages or underperforming segments) without needing raw-data exploration first.

From an implementation perspective, I kept the module as a React + TypeScript SPA embedded within an assumed host application and avoided unnecessary routing/auth complexity for challenge scope. That trade-off improves delivery speed and demo clarity while preserving a path to production hardening (API-backed aggregation, richer navigation, and stronger role/access controls).

### Trade-offs

- Client-side parsing is acceptable for challenge scope but would not be ideal at higher production volumes. A real-world solution would involve a backend DB (Postgres/BigQuery) rather than client-side CSV parsing.
- Charting increases bundle size; heavier tab content is lazy/deferred.
- Some benchmark formulas are intentionally simplified for consistency and explainability.
- For this challenge, parsing and aggregation are performed client-side; in production, I would move aggregation to API-backed services and use worker-based parsing/background processing to keep the UI responsive at larger data volumes.

## Process

I started the task by using Claude to identify the detail behind each header and ensuring that I had a clear understanding of the data and terminology used. I have a lot of domain knowledge to pick up about the mortgage industry although the terminology quickly became obvious to me as I read through the data.

I then wrote up my assumptions from reading the task, stripping back quite a bit of content to bring the scope of the challenge down to just indicate value add for users rather than including all the typical functionality that would be expected in a real application (login, sidebar, footer, etc). I collated context data such as the task information, job description, screenshots from Acre's website for styling reference and fed these to Claude to research and generate a detailed plan of the task and generate initial mock ups.

I wrote some user stories for the task to help guide the development of the app, looking at the data and understanding the context to generate the stories. I then used Claude to tidy these up and best identify the user names.

I ran the plan in Cursor to generate the initial code for the task, reviewing the output on Thursday evening. I then slept on it and reviewed the output again on Friday morning, first committing to GitHub after some minor UI/layout improvements. I spent Friday afternoon setting up further visualisation charts to add to the dashboard.

I double checked that the dashboard values were correct and aligned with the data in the CSV file by converting the CSV into Excel formula and analysing the data using formulas. I checked the data against the dashboard design on Sunday afternoon and made some minor adjustments to the dashboard to ensure that the data was displayed correctly and optimally.

In a working environment, my behaviour towards regular git pushes would change to include more commits and smaller commits to help with code review and collaboration.

On Monday morning I cleaned up the repo and README.md file and committed the final version to GitHub for submission.

## Data Quality

### Current handling in this implementation

- Values in CSV monetary fields are interpreted as pence and converted to pounds for display.
- Multiple date/time formats are normalized during parsing to support consistent aggregation and charting. For a production app, I would be working to standardise the data in the database rather than in the application.
- Parse quality and missing-data conditions are surfaced in data quality-oriented UI areas.
- Outlier filtering is applied for some risk views (e.g. very high LTV exclusions) to avoid misleading summaries.
- The "initial_pay_rate" values came in in the format of 454000 which I have assumed to be 4.54% based on realistic rates from the market.

### Known data limitations

- Important fields have low population in places (especially lender and mortgage value), which affects confidence for some lender-level metrics.
- Dataset covers 2025 only, so some year-over-year trend cards show no prior-period baseline.
- The market average in lender pages uses selected-period row averages; production logic would require stricter completeness and quality gating.
- In a production app, I would validate the data at ingestion and route missing/invalid data such as missing lender rows to a quarantine stream with reason codes and track blank-lender rate as a data quality SLI with alert thresholds.
- For the Median Days from recommendation to submission, the value I am using is coming out as 0, as sometimes the recommendation_date is after the first_submitted_date so my definition of this needs to be reviewed with better understanding of the process.

### Pipeline stage grouping assumptions

To avoid cluttering the dashboard funnel, I added a grouping for case status, listed below. These could be adjusted to better reflect working assumptions in the production app. Statuses are grouped as:

- Stage 1 (Lead): `LEAD`
- Stage 2 (Recommendation): `PRE_RECOMMENDATION`, `POST_RECOMMENDATION_REVIEW`
- Stage 3 (Application): `PRE_APPLICATION`, `REVIEW`, `APPLICATION_SUBMITTED`, `REFERRED`
- Stage 4 (Offer): `AWAITING_VALUATION`, `AWAITING_OFFER`, `OFFER_RECEIVED`
- Stage 5 (Completion): `EXCHANGE`, `COMPLETE`
- Exit stage: `NOT_PROCEEDING`
- System admin states excluded: `IMPORTING`, `IMPORTED_COMPLETE`

## Further Ideation

With additional time, user research would guide feature prioritization before implementation. Adding proper discovery to the process will ensure that the features are actually needed and valuable to the users. However, below I have outlined some possible areas for extension.

### Product and UX priorities

- Optimised Overview tabs to show the most important insights first based on user research.
- Optimised data loading between pages to avoid the data being reloaded on every page change.
- Accessibility improvements (ARIA semantics, assistive technology support) are identified as a next-step focus area.
- Performance and polish improvements would target loading behavior (adding skeletons), tooltips, micro-interactions, and navigation smoothness.

### Potential feature extensions

- Additional filtering across case type/status and other dimensions for deeper investigative workflows.
- More granular export options by chart/table/page instead of only broad exports.
- With more time, I would also consider adding extra pipeline analysis, investigating more cases stuck in the pipeline at certain stages to understand why and what can be done to improve the process. For this demo, I have added a few insights to the lender dashboard for cases stalled at submitted to give a feel for the type of analysis that could be done.
- If it was known that a lenders entire mortgage case profile was stored on Acre, we could add additional information such as how much total loan value they are committed to.

### Data and modelling enhancements desired

- Better upstream data completeness and quality controls for key attributes. I began mocking up some data checking functionality in a local Excel file (e.g. if a case is at "PRE_RECOMMENDATION", check that the data has a mortgage value and LTV value), but considered the full implementation out of scope for this challenge.
- Visibility of case status immediately prior to `NOT_PROCEEDING` to improve root-cause analysis. Without this, it can be difficult to understand from the data where the case was lost for further analysis.
- Lookup enrichment for organisation, advisor, and case manager to unlock user-personalized analytics.
- Currently, the market average used on the Lender dashboard is the average of all rows of the data in the selected period. In a production app, I would use a more sophisticated approach to calculate the market average based on checked and completed data after deeper interrogation of the incomplete data rows.

## User Stories

### Acre Internal Users

**AI-01**
As an **Acre Account Manager**, I want to see completed case volume and total loan value ranked by lender, so that I can identify which lender partnerships are driving the most platform activity and prioritise my relationship management accordingly.

**AI-02**
As an **Acre Product Manager**, I want to see a breakdown of case volumes by case type (first-time buyer, remortgage, house move, buy-to-let), so that I can align product development priorities to the most common customer journeys on the platform.

**AI-03**
As an **Acre Platform Analyst**, I want to see funnel conversion rates at each pipeline stage (Lead → Recommendation → Application → Offer → Complete), so that I can establish a platform-wide benchmark for what good conversion performance looks like across lenders.

**AI-04**
As an **Acre Operations Lead**, I want to view case creation and completion volumes aggregated by week and by month across all lenders, so that I can identify seasonal patterns or unexpected drops in activity that may warrant operational intervention.

**AI-05**
As an **Acre Platform Analyst**, I want to see which case types have the highest completion rate and which have the highest rate of not proceeding, so that I can investigate where friction exists in the process and surface improvement opportunities to the product team.

**AI-06**
As an **Acre Platform Analyst**, I want to see the platform-wide average number of days from submission to offer, and from submission to completion, for a given period, so that I can track overall processing efficiency and set market benchmarks for lender performance reviews.

**AI-07**
As an **Acre Platform Analyst**, I want to see a breakdown of cases by initial rate type (fixed, tracker, discount, variable) and by average mortgage term length for a given period, so that I can understand which products are most prevalent across the platform and identify shifts in the product mix over time.

**AI-08**
As an **Acre Platform Analyst**, I want to see average net case revenue broken down by case type, so that I can identify which case types are the most commercially valuable to the platform and inform prioritisation decisions.

**AI-09**
As an **Acre Finance Analyst**, I want to see total broker fees, gross and net procurement fees, and net case revenue aggregated across the platform for a selectable time period, so that I can produce accurate commercial performance reports for internal and board-level stakeholders.

**AI-10**
As an **Acre Platform Analyst**, I want to see the total number and proportion of cases that are FCA-regulated for a given period, so that I can ensure our compliance reporting obligations are met and flag any anomalies to the compliance team.

**AI-11**
As an **Acre Platform Analyst**, I want to see the volume and proportion of cases flagged as product transfers, consumer buy-to-let, further advances, and porting cases respectively, so that I can understand the composition of our case book and correctly exclude or segment these case types in pipeline and conversion analysis.

**AI-12**
As an **Acre Platform Analyst**, I want to see how many completed mortgage cases have an associated linked protection product, so that I can track protection penetration across the platform and support cross-sell performance reporting.

**AI-13**
As any **authenticated user**, I want to filter all dashboard views by a custom date range (defaulting to the current calendar year), so that I can analyse performance for any specific period without being constrained to a fixed time window.

**AI-14**
As an **Acre Platform Analyst**, I want to see a ranked breakdown of not-proceeding reasons across all cases on the platform for a given period, so that I can identify the most common causes of case loss and share systemic findings with lender partners.

**AI-15**
As an **Acre Platform Analyst**, I want to see case volumes and completion rates segmented by club or network affiliation, so that I can understand which distribution channels are most active on the platform and identify partnership opportunities.

### Lender Partners

**LP-01**
As a **Lender Product Manager**, I want to see my total completed case volume, total loan value, and net revenue for a selected time period, so that I can assess our overall performance on the platform at a glance.

**LP-02**
As a **Lender Product Manager**, I want to see my average net revenue per case compared to the platform-wide average, so that I can understand whether my cases are generating above- or below-average commercial value relative to the broader market.

**LP-03**
As a **Lender Product Manager**, I want to see net revenue broken down by case type for my lender versus the platform average, so that I can identify which case types are most profitable for us and where we may be underperforming the market commercially.

**LP-04**
As a **Lender Product Manager**, I want to understand the reasons why cases with my lender are not proceeding, compared to the distribution of not-proceeding reasons across the platform, so that I can identify whether specific process or product issues are driving avoidable case loss.

**LP-05**
As a **Lender Risk Officer**, I want to see the distribution of LTV ratios across my active and completed case book, segmented into standard risk bands (<60%, 60–75%, 75–85%, 85–95%, 95%+), benchmarked against the platform-wide distribution, so that I can assess whether our portfolio is concentrating in higher-risk lending relative to the market.

**LP-06**
As a **Lender Product Designer**, I want to see the LTV bands where platform-wide case volume is growing but my lender's share is low, so that I can identify product or pricing gaps and adjust our rate strategy to capture that missing volume.

**LP-07**
As a **Lender Business Development Manager**, I want to see my completed case volume, average LTV, and average mortgage amount benchmarked against the platform-wide averages, so that I can quickly identify whether we are over- or under-indexing in any area relative to our competitors.

**LP-08**
As a **Lender Product Manager**, I want to see our average number of days from submission to offer, and from submission to completion, for a given period benchmarked against the platform average, so that I can monitor our processing efficiency and track improvements over time.

**LP-09**
As a **Lender Operations Manager** and **Lender Underwriting Manager**, I want to see a timeline comparison of our average days between submission and offer versus the platform average, broken down by month, so that I can identify whether our internal processes are creating delays that risk losing brokers to faster competitors.

**LP-10**
As a **Lender Business Development Manager**, I want to see cases currently sitting in "Application Submitted" or "Awaiting Offer" that have already exceeded the platform-average dwell time for that stage, so that I can proactively flag them for follow-up and reduce the risk of those cases not proceeding.

**LP-11**
As a **Lender Product Manager**, I want to see a time-based trend of my case creation and completion volumes by week or month, so that I can identify whether our platform activity is growing, declining, or seasonal compared to overall market trends.

**LP-12**
As a **Lender Product Manager**, I want to see a breakdown of my completed cases by initial rate type (fixed, tracker, discount, variable) and average term length, benchmarked against the platform-wide distribution, so that I can understand whether brokers are recommending our products in line with - or against - broader market demand, and adjust our product strategy accordingly.

**LP-13**
As a **Lender Product Manager**, I want to see the volume and proportion of my cases that are FCA-regulated and those that are product transfers, so that I can accurately segment our case book for compliance reporting and ensure product transfer cases are excluded from full pipeline analysis where appropriate.

**LP-14**
As a **Lender Risk Officer**, I want to see the distribution of mortgage amounts across my case book compared to the platform-wide distribution, so that I can assess whether we are over-exposed to high-value lending or missing volume in lower-value segments.

**LP-15**
As a **Lender Product Manager**, I want to export any dashboard view as a CSV or PDF, so that I can share performance data with internal stakeholders who do not have access to the dashboard.

## Testing

To help with development of the application, I wrote some tests to cover the key functionality of the application and help guide the AI writing of code.

Run:

```bash
npm run test
```

Coverage areas include CSV parsing, period filtering, key metric calculations, data loading transitions, and shell-level smoke checks.

In a production environment, I would also consider using a testing framework such as Jest or Playwright to help with fully testing the application through E2E tests across multiple lenders, browsers and devices and ensuring that the application is working as expected.
