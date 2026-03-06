"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tooltipStyle, EMPTY_STATE_HEIGHT } from "./chart-styles";

interface PipelineFunnelProps {
  data: Array<{ stage: string; count: number; value: number }>;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  const chartId = useId();
  const gradId = (i: number) => `funnel-${chartId}-${i}`;

  if (data.length === 0) {
    return (
      <div style={{ height: EMPTY_STATE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))' }}>
        No pipeline data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
        <defs>
          {COLORS.map((color, i) => (
            <linearGradient key={`grad-${i}`} id={gradId(i)} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="var(--border)"
          strokeOpacity={0.3}
        />
        <XAxis
          type="number"
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="stage"
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          cursor={{ fill: 'color-mix(in oklab, var(--chart-1) 8%, transparent)' }}
          contentStyle={tooltipStyle}
        />
        <Bar
          dataKey="count"
          radius={[0, 6, 6, 0]}
          maxBarSize={40}
          animationDuration={1000}
          animationEasing="ease-out"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={`url(#${gradId(index % COLORS.length)})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
