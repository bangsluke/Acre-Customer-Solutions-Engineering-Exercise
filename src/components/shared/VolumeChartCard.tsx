import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeLinearTrend } from '../../utils/trendLine';
import { formatNumber } from '../../utils/formatters';
import {
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
} from './tooltipStyles';

const SHARED_CHART_MARGIN = { top: 8, right: 16, left: 20, bottom: 30 };
const SHARED_Y_AXIS_WIDTH = 64;

export interface VolumeChartPoint {
  key: string;
  label: string;
  count: number;
}

interface VolumeChartCardProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  xAxisLabel: string;
  data: VolumeChartPoint[];
  headerActions?: ReactNode;
}

export function VolumeChartCard({ title, subtitle, ariaLabel, xAxisLabel, data, headerActions }: VolumeChartCardProps) {
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);
  const series = useMemo(() => {
    const trendValues = computeLinearTrend(data.map((row) => row.count));
    return data.map((row, index) => ({
      ...row,
      trend: trendValues[index] ?? row.count,
    }));
  }, [data]);
  const averageVolume = series.length ? series.reduce((sum, row) => sum + row.count, 0) / series.length : 0;
  const peakVolumePoint = series.slice().sort((a, b) => b.count - a.count)[0];

  return (
    <section className="rounded-xl border border-acre-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl font-semibold text-acre-text">{title}</h3>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-acre-muted">
        <p>{subtitle}</p>
        {peakVolumePoint ? <span className="text-xs">Peak: {formatNumber(peakVolumePoint.count)}</span> : null}
      </div>
      <div className="mt-4 h-[260px]" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
          <BarChart
            data={series}
            margin={SHARED_CHART_MARGIN}
            onMouseMove={(state) => {
              setActiveBarIndex(state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null);
            }}
            onMouseLeave={() => setActiveBarIndex(null)}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="#374151"
              tick={{ fill: '#374151', fontSize: 12 }}
              tickLine={{ stroke: '#374151' }}
              axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
              tickMargin={10}
              label={{ value: xAxisLabel, position: 'bottom', offset: 10, fill: '#374151', fontSize: 12 }}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: '#374151', fontSize: 12 }}
              tickLine={{ stroke: '#374151' }}
              axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
              width={SHARED_Y_AXIS_WIDTH}
              allowDecimals={false}
              tickFormatter={(value) => formatNumber(Math.round(Number(value)))}
              tickMargin={8}
              label={{ value: 'Cases', angle: -90, position: 'insideLeft', offset: 0, fill: '#374151', fontSize: 12 }}
            />
            <ReferenceLine
              y={averageVolume}
              stroke="#1D9E75"
              strokeDasharray="4 4"
              label={{
                value: `Avg: ${formatNumber(Math.round(averageVolume))}`,
                position: 'insideTopRight',
                fill: '#1D9E75',
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(value, name) => [formatNumber(Math.round(Number(value))), name === 'trend' ? 'Trend' : 'Cases']}
              contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
              itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
            />
            <Line type="monotone" dataKey="trend" stroke="#E24B4A" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Bar dataKey="count" fill="#3D4CF9" radius={[4, 4, 0, 0]}>
              {series.map((entry, index) => (
                <Cell key={`${entry.key}-count`} fillOpacity={activeBarIndex === null || activeBarIndex === index ? 1 : 0.35} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
