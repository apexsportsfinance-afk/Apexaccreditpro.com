import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * "Neural Pulse" — a constellation of glowing nodes connected by animated
 * data-flow lines. Represents the platform as a smart, multi-event
 * accreditation/network system rather than any single sport.
 */
export default function SwimmingBackground({ children }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const lineColor = isDark ? "rgba(99,179,237,0.45)" : "rgba(79,70,229,0.28)";
  const nodeColor = isDark ? "rgba(129,212,250,0.95)" : "rgba(79,70,229,0.85)";

  const lines = [
    { x1: 8, y1: 18, x2: 32, y2: 8, delay: 0 },
    { x1: 32, y1: 8, x2: 58, y2: 22, delay: 1.4 },
    { x1: 58, y1: 22, x2: 84, y2: 12, delay: 0.6 },
    { x1: 14, y1: 46, x2: 38, y2: 30, delay: 2.1 },
    { x1: 38, y1: 30, x2: 62, y2: 48, delay: 0.3 },
    { x1: 62, y1: 48, x2: 88, y2: 38, delay: 1.8 },
    { x1: 6, y1: 74, x2: 30, y2: 62, delay: 0.9 },
    { x1: 30, y1: 62, x2: 56, y2: 80, delay: 2.5 },
    { x1: 56, y1: 80, x2: 80, y2: 66, delay: 1.1 },
    { x1: 80, y1: 66, x2: 94, y2: 88, delay: 0.4 },
    { x1: 38, y1: 30, x2: 30, y2: 62, delay: 1.6 },
    { x1: 58, y1: 22, x2: 62, y2: 48, delay: 2.8 },
  ];
  const nodes = [
    [8, 18], [32, 8], [58, 22], [84, 12], [14, 46], [38, 30],
    [62, 48], [88, 38], [6, 74], [30, 62], [56, 80], [80, 66], [94, 88],
  ];

  return (
    <>
      <style>{`
        @keyframes apx-neural-flow {
          0%   { stroke-dashoffset: 24; opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes apx-neural-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%       { transform: scale(1.8); opacity: 1; }
        }
        @keyframes apx-neural-drift {
          0%, 100% { transform: translate(0,0); }
          50%       { transform: translate(-1.5%, 1%); }
        }
      `}</style>

      <div
        className="relative min-h-screen overflow-hidden"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 120% 80% at 50% -10%, #0d1a3d 0%, #060c1f 45%, #030712 100%)"
            : "radial-gradient(ellipse 120% 80% at 50% -10%, #eef2ff 0%, #e7ecfb 45%, #f4f6fd 100%)",
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            zIndex: 1, animation: "apx-neural-drift 26s ease-in-out infinite",
          }}
        >
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={lineColor}
              strokeWidth="0.18"
              strokeDasharray="6 18"
              style={{
                animation: `apx-neural-flow 6s linear infinite`,
                animationDelay: `${l.delay}s`,
              }}
            />
          ))}
          {nodes.map(([x, y], i) => (
            <circle
              key={i}
              cx={x} cy={y} r="0.6"
              fill={nodeColor}
              style={{
                animation: "apx-neural-pulse 4s ease-in-out infinite",
                animationDelay: `${(i % 6) * 0.6}s`,
                filter: `drop-shadow(0 0 3px ${nodeColor})`,
              }}
            />
          ))}
        </svg>

        {/* soft ambient glow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: isDark
              ? "radial-gradient(circle at 50% 0%, rgba(79,70,229,0.25) 0%, transparent 55%)"
              : "radial-gradient(circle at 50% 0%, rgba(79,70,229,0.10) 0%, transparent 55%)",
          }}
        />

        {/* bottom fade for form readability */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: 240, zIndex: 2,
            background: isDark
              ? "linear-gradient(to top, rgba(3,7,18,0.75) 0%, transparent 100%)"
              : "linear-gradient(to top, rgba(244,246,253,0.75) 0%, transparent 100%)",
          }}
        />

        <div className="relative" style={{ zIndex: 10 }}>
          {children}
        </div>
      </div>
    </>
  );
}
