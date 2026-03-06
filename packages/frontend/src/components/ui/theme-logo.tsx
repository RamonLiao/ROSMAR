'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function ThemeLogo({ width = 28, height = 28, className }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render light logo on server
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Image
      src="/rosmar_logo.svg"
      alt="ROSMAR"
      width={width}
      height={height}
      className={className ?? ''}
      priority
    />
  );
}
