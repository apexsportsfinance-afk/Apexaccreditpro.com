import React, { useEffect, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function SwimmingBackground({ children, variant = "default" }) {
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const getWaveColors = (currentTheme) => {
    if (currentTheme === 'dark') {
      return [
        "rgba(6, 182, 212, 0.08)",
        "rgba(14, 165, 233, 0.06)",
        "rgba(34, 211, 238, 0.05)"
      ];
    }
    return [
      "rgba(6, 182, 212, 0.12)",
      "rgba(14, 165, 233, 0.1)",
      "rgba(34, 211, 238, 0.08)"
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const getSize = () => ({
      width: canvas.parentElement?.offsetWidth || window.innerWidth,
      height: canvas.parentElement?.offsetHeight || window.innerHeight
    });

    let { width, height } = getSize();
    canvas.width = width;
    canvas.height = height;

    const waves = [
      { amplitude: 40, frequency: 0.008, speed: 0.02, offset: 0, y: 0.3 },
      { amplitude: 30, frequency: 0.012, speed: 0.015, offset: Math.PI, y: 0.5 },
      { amplitude: 50, frequency: 0.006, speed: 0.01, offset: Math.PI / 2, y: 0.7 }
    ];

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const colors = getWaveColors(theme);
      waves.forEach((wave, i) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 2) {
          const y =
            wave.y * height +
            wave.amplitude * Math.sin(x * wave.frequency + t * wave.speed + wave.offset);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
      });

      t++;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      const size = getSize();
      width = size.width;
      height = size.height;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme]);

  const bgClass = theme === 'dark' 
    ? "bg-gradient-to-br from-slate-900 via-cyan-950 to-blue-950" 
    : "bg-gradient-to-br from-white via-slate-50 to-cyan-50";

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-500 ${bgClass}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
