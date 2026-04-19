import { AppTooltip } from './AppTooltip';

export function LastUpdatedFooter() {
  return (
    <AppTooltip content="Real application would use a live value" wrapperClassName="mt-8 block">
      <footer className="text-center text-xs text-acre-muted desktop-md:text-right">Last updated: 14 Apr 2026, 04:17</footer>
    </AppTooltip>
  );
}
