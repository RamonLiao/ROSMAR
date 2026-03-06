"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tooltipStyle, EMPTY_STATE_HEIGHT } from "./chart-styles";

interface ScoreDistributionProps {
  data: Array<{ range: string; count: number }>;
}

export function ScoreDistribution({ data }: ScoreDistributionProps) {
  if (data.length === 0) {
    return (
      <div style={{ height: EMPTY_STATE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))' }}>
        No score data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border)"
          strokeOpacity={0.3}
        />
        <XAxis
          dataKey="range"
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dx={-5}
        />
        <Tooltip
          cursor={{ fill: 'color-mix(in oklab, var(--chart-1) 10%, transparent)' }}
          contentStyle={tooltipStyle}
        />
        <Bar
          dataKey="count"
          fill="var(--chart-1)"
          activeBar={{ fill: 'color-mix(in oklab, var(--chart-1) 80%, hsl(var(--background)))' }}
          radius={[6, 6, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
