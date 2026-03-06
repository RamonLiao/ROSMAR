"use client";

import {
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScatterShapeProps } from "recharts";
import { tooltipStyle, EMPTY_STATE_HEIGHT } from "./chart-styles";

interface ActivityHeatmapProps {
  data: Array<{ day: string; hour: number; activity: number }>;
}

/* Heatmap color scale using CSS custom properties.
   We can't read CSS vars in JS at render time without a ref,
   so we use the hardcoded teal palette that matches --chart-1. */
const HEAT_COLORS = {
  empty: "hsl(var(--muted))",
  low: "color-mix(in oklab, var(--chart-1) 30%, var(--muted))",
  mid: "color-mix(in oklab, var(--chart-1) 60%, var(--muted))",
  high: "var(--chart-1)",
} as const;

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  if (data.length === 0) {
    return (
      <div style={{ height: EMPTY_STATE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))' }}>
        No activity data
      </div>
    );
  }

  const getColor = (activity: number) => {
    if (activity === 0) return HEAT_COLORS.empty;
    if (activity < 10) return HEAT_COLORS.low;
    if (activity < 30) return HEAT_COLORS.mid;
    return HEAT_COLORS.high;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <XAxis
          type="number"
          dataKey="hour"
          domain={[0, 23]}
          tickCount={24}
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          type="category"
          dataKey="day"
          stroke="var(--muted-foreground)"
          fill="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dx={-10}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }}
          contentStyle={tooltipStyle}
        />
        <Scatter
          data={data}
          animationDuration={800}
          animationEasing="ease-out"
          shape={(props: ScatterShapeProps) => {
            const { cx, cy, fill } = props as ScatterShapeProps & { fill: string };
            return <rect x={(cx ?? 0) - 8} y={(cy ?? 0) - 8} width={16} height={16} rx={3} ry={3} fill={fill} />;
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.activity)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
