import type { CSSProperties } from 'react';

export const APP_TOOLTIP_PANEL_CLASSNAME =
  'pointer-events-none absolute z-30 w-max min-w-40 max-w-[min(24rem,calc(100vw-1rem))] whitespace-normal break-words rounded-md bg-acre-text px-3 py-2 text-sm font-medium leading-5 text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]';

export const RECHARTS_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#22232A',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  padding: '8px 10px',
  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
};

export const RECHARTS_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '16px',
  marginBottom: '2px',
};

export const RECHARTS_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: '16px',
};
