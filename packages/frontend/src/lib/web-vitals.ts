import type { Metric } from 'web-vitals';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function reportWebVitals(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: Date.now(),
  });

  const url = `${API_URL}/analytics/vitals`;

  // Use sendBeacon for reliability (survives page unload)
  // Must use Blob to set Content-Type — sendBeacon with string sends text/plain
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }
}
