import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeFilter } from '../components/shared/TimeFilter';

describe('TimeFilter', () => {
  it('keeps custom inputs disabled for non-custom periods', () => {
    render(<TimeFilter activePeriod={{ type: 'this_year' }} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Start month')).toBeDisabled();
    expect(screen.getByLabelText('Start day')).toBeDisabled();
    expect(screen.getByLabelText('End month')).toBeDisabled();
    expect(screen.getByLabelText('End day')).toBeDisabled();
  });

  it('shows warning for incompatible custom date combination', async () => {
    const onChange = vi.fn();
    render(<TimeFilter activePeriod={{ type: 'custom' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Start month'), { target: { value: 'February' } });
    fireEvent.change(screen.getByLabelText('Start day'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('End month'), { target: { value: 'March' } });
    fireEvent.change(screen.getByLabelText('End day'), { target: { value: '10' } });

    expect(await screen.findByText(/Incompatible date combination entered/i)).toBeInTheDocument();
    expect(
      onChange.mock.calls.some(
        (args) => args[0]?.type === 'custom' && args[0]?.start instanceof Date && args[0]?.end instanceof Date,
      ),
    ).toBe(false);
  });

  it('applies custom date filter when all values are valid', async () => {
    const onChange = vi.fn();
    render(<TimeFilter activePeriod={{ type: 'custom' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Start month'), { target: { value: 'March' } });
    fireEvent.change(screen.getByLabelText('Start day'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('End month'), { target: { value: 'April' } });
    fireEvent.change(screen.getByLabelText('End day'), { target: { value: '20' } });

    await waitFor(() => {
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
});
