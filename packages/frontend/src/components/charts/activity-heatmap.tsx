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

interface ActivityHeatmapProps {
  data: Array<{ day: string; hour: number; activity: number }>;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const getColor = (activity: number) => {
    if (activity === 0) return "hsl(var(--muted))";
    if (activity < 10) return "hsl(var(--primary) / 0.2)";
    if (activity < 30) return "hsl(var(--primary) / 0.5)";
    return "hsl(var(--primary))";
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart>
        <XAxis type="number" dataKey="hour" domain={[0, 23]} />
        <YAxis type="category" dataKey="day" />
        <Tooltip />
        <Scatter data={data}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.activity)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
