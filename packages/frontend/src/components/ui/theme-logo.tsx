'use client';

import Image from 'next/image';

interface ThemeLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function ThemeLogo({ width = 28, height = 28, className }: ThemeLogoProps) {
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
