'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/web-vitals';

export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamic import web-vitals (heavy lib) — only in browser
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      onLCP(reportWebVitals);
      onINP(reportWebVitals);
      onCLS(reportWebVitals);
      onFCP(reportWebVitals);
      onTTFB(reportWebVitals);
    });
  }, []);

  return null;
}
