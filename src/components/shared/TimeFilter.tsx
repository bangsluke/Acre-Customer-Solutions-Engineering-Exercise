import { useEffect, useMemo, useState } from 'react';
import { TIME_FILTERS } from '../../utils/constants';
import type { TimePeriod } from '../../types/mortgage';

interface TimeFilterProps {
  activePeriod: TimePeriod;
  onChange: (next: TimePeriod) => void;
}

interface DateInputFieldProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  widthClass: string;
  disabled: boolean;
  hasError: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function dayOptionsForMonth(monthIndex: number | null) {
  if (monthIndex === null) {
    return Array.from({ length: 31 }, (_, idx) => String(idx + 1));
  }
  const daysInMonth = new Date(2025, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, idx) => String(idx + 1));
}

function monthToIndex(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) {
    return asNumber - 1;
  }

  const monthMatch = MONTH_NAMES.findIndex((name) => name.toLowerCase().startsWith(trimmed.toLowerCase()));
  return monthMatch >= 0 ? monthMatch : null;
}

function parseDay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const day = Number(trimmed);
  return Number.isInteger(day) ? day : null;
}

function DateInputField({
  id,
  label,
  value,
  options,
  widthClass,
  disabled,
  hasError,
  isOpen,
  onToggleOpen,
  onOpen,
  onClose,
  onChange,
}: DateInputFieldProps) {
  const hasValue = value.trim().length > 0;
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = normalizedValue
    ? options.filter((option) => option.toLowerCase().includes(normalizedValue))
    : options;

  return (
    <div
      className={`relative ${widthClass}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
      }}
    >
      <input
        id={id}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        onFocus={onOpen}
        disabled={disabled}
        className={`peer h-[34px] w-full rounded-md border px-3 pr-8 pt-[14px] text-sm font-normal leading-5 transition focus:outline-none focus:ring-1 focus:ring-acre-purple ${
          hasError ? 'border-red-300' : 'border-acre-border'
        } ${
          disabled
            ? 'cursor-not-allowed bg-acre-panel text-acre-muted'
            : 'bg-white text-acre-text hover:border-acre-purple-light'
        }`}
      />
      <button
        type="button"
        aria-label={`Toggle ${label} options`}
        onClick={onToggleOpen}
        disabled={disabled}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-acre-muted transition hover:text-acre-text disabled:cursor-not-allowed disabled:text-acre-border"
      >
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 7L10 12L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-2 z-10 px-0.5 text-acre-muted transition-all peer-focus:top-0 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:text-acre-purple ${
          hasValue ? 'top-0 translate-y-0 text-[10px]' : 'top-1/2 -translate-y-1/2 text-sm'
        }`}
        style={{ background: disabled ? '#F7F7F4' : '#FFFFFF' }}
      >
        {label}
      </label>
      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-44 overflow-auto rounded-md border border-acre-purple bg-white py-1 shadow-md">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm font-normal leading-5 text-acre-text hover:bg-acre-panel"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  onClose();
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-acre-muted">No matches</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TimeFilter({ activePeriod, onChange }: TimeFilterProps) {
  const active = activePeriod.type;
  const [startMonthInput, setStartMonthInput] = useState('');
  const [startDayInput, setStartDayInput] = useState('');
  const [endMonthInput, setEndMonthInput] = useState('');
  const [endDayInput, setEndDayInput] = useState('');
  const [openField, setOpenField] = useState<string | null>(null);

  useEffect(() => {
    if (activePeriod.type !== 'custom' || !activePeriod.start || !activePeriod.end) {
      return;
    }
    setStartMonthInput(MONTH_NAMES[activePeriod.start.getMonth()]);
    setStartDayInput(String(activePeriod.start.getDate()));
    setEndMonthInput(MONTH_NAMES[activePeriod.end.getMonth()]);
    setEndDayInput(String(activePeriod.end.getDate()));
  }, [activePeriod]);

  const startMonthIndex = useMemo(() => monthToIndex(startMonthInput), [startMonthInput]);
  const endMonthIndex = useMemo(() => monthToIndex(endMonthInput), [endMonthInput]);
  const startDayValue = useMemo(() => parseDay(startDayInput), [startDayInput]);
  const endDayValue = useMemo(() => parseDay(endDayInput), [endDayInput]);

  const validationMessage = useMemo(() => {
    if (active !== 'custom') {
      return null;
    }

    const values = [startMonthInput, startDayInput, endMonthInput, endDayInput];
    const filledCount = values.filter((value) => value.trim() !== '').length;
    if (filledCount > 0 && filledCount < 4) {
      return 'Complete all Start/End month/day fields to apply a custom date range.';
    }
    if (filledCount === 0) {
      return null;
    }

    if (startMonthIndex === null || endMonthIndex === null) {
      return 'Invalid month value. Use month name (or 1-12).';
    }
    if (startDayValue === null || endDayValue === null) {
      return 'Invalid day value. Use whole numbers only.';
    }
    if (startDayValue < 1 || endDayValue < 1) {
      return 'Day values must be greater than 0.';
    }

    const startDate = new Date(2025, startMonthIndex, startDayValue);
    const endDate = new Date(2025, endMonthIndex, endDayValue);
    const startMatches =
      startDate.getFullYear() === 2025 &&
      startDate.getMonth() === startMonthIndex &&
      startDate.getDate() === startDayValue;
    const endMatches =
      endDate.getFullYear() === 2025 &&
      endDate.getMonth() === endMonthIndex &&
      endDate.getDate() === endDayValue;

    if (!startMatches || !endMatches) {
      return 'Incompatible date combination entered. Please check month/day values.';
    }
    if (startDate.getTime() > endDate.getTime()) {
      return 'Start date must be on or before end date.';
    }

    return null;
  }, [
    active,
    startMonthInput,
    startDayInput,
    endMonthInput,
    endDayInput,
    startMonthIndex,
    endMonthIndex,
    startDayValue,
    endDayValue,
  ]);

  useEffect(() => {
    if (active !== 'custom') {
      return;
    }
    if (validationMessage) {
      return;
    }
    const values = [startMonthInput, startDayInput, endMonthInput, endDayInput];
    if (values.some((value) => value.trim() === '')) {
      return;
    }
    if (startMonthIndex === null || endMonthIndex === null || startDayValue === null || endDayValue === null) {
      return;
    }

    const nextStart = new Date(2025, startMonthIndex, startDayValue);
    const nextEnd = new Date(2025, endMonthIndex, endDayValue);
    const sameAsCurrent =
      activePeriod.type === 'custom' &&
      activePeriod.start?.getTime() === nextStart.getTime() &&
      activePeriod.end?.getTime() === nextEnd.getTime();
    if (sameAsCurrent) {
      return;
    }

    onChange({ type: 'custom', start: nextStart, end: nextEnd });
  }, [
    active,
    validationMessage,
    startMonthInput,
    startDayInput,
    endMonthInput,
    endDayInput,
    startMonthIndex,
    endMonthIndex,
    startDayValue,
    endDayValue,
    activePeriod,
    onChange,
  ]);

  const isCustom = active === 'custom';
  const dayOptionsStart = dayOptionsForMonth(startMonthIndex);
  const dayOptionsEnd = dayOptionsForMonth(endMonthIndex);

  return (
    <div className="mt-4" role="group" aria-label="Time period filters">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {TIME_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange({ type: item.id })}
            aria-pressed={active === item.id}
            className={`inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm font-normal leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple ${
              active === item.id
                ? 'border-acre-purple bg-acre-purple-bg text-acre-purple'
                : 'border-acre-border bg-white text-acre-muted hover:border-acre-purple-light hover:text-acre-text'
            }`}
          >
            {item.id === 'custom' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M8 2V5M16 2V5M3 9H21M5 5H19C20.1 5 21 5.9 21 7V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V7C3 5.9 3.9 5 5 5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            {item.label}
          </button>
        ))}

        <DateInputField
          id="start-month"
          label="Start month"
          options={[...MONTH_NAMES]}
          widthClass="w-[122px]"
          value={startMonthInput}
          onChange={setStartMonthInput}
          disabled={!isCustom}
          hasError={Boolean(validationMessage && isCustom)}
          isOpen={openField === 'start-month'}
          onOpen={() => setOpenField('start-month')}
          onClose={() => setOpenField((current) => (current === 'start-month' ? null : current))}
          onToggleOpen={() => setOpenField((current) => (current === 'start-month' ? null : 'start-month'))}
        />
        <DateInputField
          id="start-day"
          label="Start day"
          options={dayOptionsStart}
          widthClass="w-[98px]"
          value={startDayInput}
          onChange={setStartDayInput}
          disabled={!isCustom}
          hasError={Boolean(validationMessage && isCustom)}
          isOpen={openField === 'start-day'}
          onOpen={() => setOpenField('start-day')}
          onClose={() => setOpenField((current) => (current === 'start-day' ? null : current))}
          onToggleOpen={() => setOpenField((current) => (current === 'start-day' ? null : 'start-day'))}
        />
        <DateInputField
          id="end-month"
          label="End month"
          options={[...MONTH_NAMES]}
          widthClass="w-[122px]"
          value={endMonthInput}
          onChange={setEndMonthInput}
          disabled={!isCustom}
          hasError={Boolean(validationMessage && isCustom)}
          isOpen={openField === 'end-month'}
          onOpen={() => setOpenField('end-month')}
          onClose={() => setOpenField((current) => (current === 'end-month' ? null : current))}
          onToggleOpen={() => setOpenField((current) => (current === 'end-month' ? null : 'end-month'))}
        />
        <DateInputField
          id="end-day"
          label="End day"
          options={dayOptionsEnd}
          widthClass="w-[98px]"
          value={endDayInput}
          onChange={setEndDayInput}
          disabled={!isCustom}
          hasError={Boolean(validationMessage && isCustom)}
          isOpen={openField === 'end-day'}
          onOpen={() => setOpenField('end-day')}
          onClose={() => setOpenField((current) => (current === 'end-day' ? null : current))}
          onToggleOpen={() => setOpenField((current) => (current === 'end-day' ? null : 'end-day'))}
        />
      </div>

      <p className="mt-2 h-4 text-right text-xs text-red-600">
        {isCustom && validationMessage ? validationMessage : '\u00A0'}
      </p>
    </div>
  );
}

