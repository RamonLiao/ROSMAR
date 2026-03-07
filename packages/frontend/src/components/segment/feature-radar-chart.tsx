'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

const AXES = [
  'Engagement',
  'Wallets',
  'Deals',
  'Campaigns',
  'Social',
  'Balance',
] as const;

interface FeatureRadarChartProps {
  centroid: number[];
  className?: string;
}

export function FeatureRadarChart({
  centroid,
  className,
}: FeatureRadarChartProps) {
  const data = AXES.map((axis, i) => ({
    axis,
    value: centroid[i] ?? 0,
  }));

  return (
    <div className={className} data-testid="feature-radar-chart">
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 1]} tick={false} />
          <Radar
            name="Centroid"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
