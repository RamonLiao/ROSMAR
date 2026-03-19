"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const IceCrystal = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <path
      d="M12 2L15 10L22 12L15 14L12 22L9 14L2 12L9 10L12 2Z"
      fill="currentColor"
      fillOpacity="0.8"
    />
    <path
      d="M12 6L13.5 11L18 12L13.5 13L12 18L10.5 13L6 12L10.5 11L12 6Z"
      fill="white"
      fillOpacity="0.4"
    />
  </svg>
);

const Anchor = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <path
      d="M12 2C13.6569 2 15 3.34315 15 5C15 6.65685 13.6569 8 12 8C10.3431 8 9 6.65685 9 5C9 3.34315 10.3431 2 12 2ZM12 10V20M6 13C6 16.3137 8.68629 19 12 19C15.3137 19 18 16.3137 18 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 13L8 13M16 13L20 13M10 20L14 20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MarineBubble = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path
      d="M7 12C7 9.23858 9.23858 7 12 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/* ── Particle dots for dark mode bioluminescent effect ── */
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 7.3) % 84)}%`,
  size: i % 3 === 0 ? 3 : 2,
  delay: `${(i * 1.25).toFixed(2)}s`,
  duration: `${13 + (i % 5) * 1.5}s`,
}));

/* ── Glow filter style for dark-mode SVGs ── */
const darkGlowStyle: React.CSSProperties = {
  filter: "drop-shadow(0 0 6px rgba(45,212,191,0.4))",
};

export function DynamicBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  const isDark = resolvedTheme === "dark";

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-1000"
    >
      {/* ── Base gradient layer ── */}
      {isDark ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1e] via-background to-[#0d1525]" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background via-blue-50/30 to-teal-50/20" />
      )}

      {/* ── Ambient glow blobs ── */}
      <div
        className={`absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[120px] animate-pulse-glow ${
          isDark ? "bg-primary/20 mix-blend-screen" : "bg-teal-300/20"
        }`}
      />
      {isDark && (
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[100px] mix-blend-screen animate-pulse-glow"
          style={{ animationDelay: "1.5s" }}
        />
      )}

      {/* ── Floating SVG elements ── */}
      <div className="absolute w-full h-full">
        {/* Top Left — Crystals */}
        <IceCrystal
          className={`absolute top-[15%] left-[10%] w-12 h-12 animate-float-slow ${
            isDark ? "text-teal-400/25" : "text-teal-500/10"
          }`}
          style={isDark ? darkGlowStyle : undefined}
        />
        <IceCrystal
          className={`absolute top-[25%] left-[20%] w-6 h-6 animate-float-fast ${
            isDark ? "text-cyan-300/20" : "text-slate-400/12"
          }`}
          style={{
            animationDelay: "0.5s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />

        {/* Top Right — Anchors */}
        <Anchor
          className={`absolute top-[20%] right-[15%] w-16 h-16 animate-float-slow ${
            isDark ? "text-teal-400/20" : "text-slate-300/15"
          }`}
          style={{
            animationDelay: "2s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />
        <MarineBubble
          className={`absolute top-[30%] right-[25%] w-8 h-8 animate-float-fast ${
            isDark ? "text-cyan-400/30" : "text-teal-400/10"
          }`}
          style={{
            animationDelay: "1s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />

        {/* Bottom Left — Bubbles & Anchors */}
        <MarineBubble
          className={`absolute bottom-[20%] left-[15%] w-14 h-14 animate-float-slow ${
            isDark ? "text-teal-300/25" : "text-sky-300/12"
          }`}
          style={{
            animationDelay: "3s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />
        <Anchor
          className={`absolute bottom-[30%] left-[25%] w-10 h-10 animate-float-fast ${
            isDark ? "text-cyan-400/20" : "text-slate-300/12"
          }`}
          style={{
            animationDelay: "1.5s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />

        {/* Bottom Right — Crystals */}
        <IceCrystal
          className={`absolute bottom-[25%] right-[20%] w-10 h-10 animate-float-slow ${
            isDark ? "text-teal-400/30" : "text-teal-400/10"
          }`}
          style={{
            animationDelay: "0.8s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />
        <MarineBubble
          className={`absolute bottom-[10%] right-[10%] w-6 h-6 animate-float-fast ${
            isDark ? "text-cyan-300/20" : "text-slate-400/10"
          }`}
          style={{
            animationDelay: "2.5s",
            ...(isDark ? darkGlowStyle : {}),
          }}
        />

        {/* Center Ambient */}
        <IceCrystal
          className={`absolute top-[50%] left-[50%] w-24 h-24 -translate-x-1/2 -translate-y-1/2 animate-pulse-glow ${
            isDark ? "text-teal-400/10" : "text-primary/8"
          }`}
          style={isDark ? darkGlowStyle : undefined}
        />
      </div>

      {/* ── Dark mode only: bioluminescent particle dots ── */}
      {isDark &&
        PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-teal-400/60"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              bottom: "-4px",
              animation: `drift-up ${p.duration} linear infinite`,
              animationDelay: p.delay,
              boxShadow: "0 0 4px rgba(45,212,191,0.5)",
            }}
          />
        ))}

      {/* ── Ocean wave strip ── */}
      <div
        className={`absolute bottom-0 left-0 w-[200%] h-32 bg-gradient-to-t from-primary/5 to-transparent animate-ocean-wave ${
          isDark ? "opacity-[0.08]" : "opacity-[0.05]"
        }`}
        style={
          isDark
            ? { filter: "drop-shadow(0 -2px 8px rgba(45,212,191,0.15))" }
            : undefined
        }
      />
    </div>
  );
}
