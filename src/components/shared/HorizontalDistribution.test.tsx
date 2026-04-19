import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HorizontalDistribution } from './HorizontalDistribution';

describe('HorizontalDistribution', () => {
  it('renders Other disclosure tooltip and toggle action', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <HorizontalDistribution
        title="Cases by type"
        subtitle="Share of all cases"
        rows={[
          { label: 'First-time buyer', value: '40%', percentage: 0.4 },
          { label: 'Other', value: '10%', percentage: 0.1 },
        ]}
        otherDisclosure={{
          tooltip: 'Includes Buy-to-let Remortgage and other grouped values.',
          expanded: false,
          onToggle,
        }}
      />,
    );

    const otherLabel = screen.getByText('Other');
    expect(otherLabel.className).toContain('border-dotted');
    await user.hover(otherLabel);
    expect(
      screen.getAllByRole('tooltip').some((tooltip) => tooltip.textContent?.includes('Includes Buy-to-let Remortgage and other grouped values.')),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
