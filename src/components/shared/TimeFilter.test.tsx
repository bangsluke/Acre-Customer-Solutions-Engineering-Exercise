import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeFilter } from './TimeFilter';

describe('TimeFilter', () => {
  it('keeps custom inputs disabled for non-custom periods', () => {
    render(<TimeFilter activePeriod={{ type: 'this_year' }} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Start month')).toBeDisabled();
    expect(screen.getByLabelText('Start day')).toBeDisabled();
    expect(screen.getByLabelText('End month')).toBeDisabled();
    expect(screen.getByLabelText('End day')).toBeDisabled();
  });

  it('shows warning for incompatible custom date combination', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeFilter activePeriod={{ type: 'custom' }} onChange={onChange} />);

    await user.type(screen.getByLabelText('Start month'), 'February');
    await user.type(screen.getByLabelText('Start day'), '30');
    await user.type(screen.getByLabelText('End month'), 'March');
    await user.type(screen.getByLabelText('End day'), '10');

    expect(screen.getByText(/Incompatible date combination entered/i)).toBeInTheDocument();
    expect(
      onChange.mock.calls.some(
        (args) => args[0]?.type === 'custom' && args[0]?.start instanceof Date && args[0]?.end instanceof Date,
      ),
    ).toBe(false);
  });

  it('applies custom date filter when all values are valid', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeFilter activePeriod={{ type: 'custom' }} onChange={onChange} />);

    await user.type(screen.getByLabelText('Start month'), 'March');
    await user.type(screen.getByLabelText('Start day'), '5');
    await user.type(screen.getByLabelText('End month'), 'April');
    await user.type(screen.getByLabelText('End day'), '20');

    const customCalls = onChange.mock.calls.filter(
      (args) => args[0]?.type === 'custom' && args[0]?.start instanceof Date && args[0]?.end instanceof Date,
    );
    const customCall = customCalls[customCalls.length - 1];
    expect(customCall).toBeTruthy();
    expect(customCall?.[0].start.getFullYear()).toBe(2025);
    expect(customCall?.[0].start.getMonth()).toBe(2);
    expect(customCall?.[0].start.getDate()).toBe(5);
    expect(customCall?.[0].end.getFullYear()).toBe(2025);
    expect(customCall?.[0].end.getMonth()).toBe(3);
    expect(customCall?.[0].end.getDate()).toBe(20);
  });
});
