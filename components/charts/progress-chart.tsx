"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProgressChartProps {
  value: number;
  max?: number;
  color?: string;
  backgroundColor?: string;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  className?: string;
}

export function ProgressChart({
  value,
  max = 100,
  color = "#3B82F6",
  backgroundColor,
  size = "md",
  showPercentage = true,
  className = "",
}: ProgressChartProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const percentage = Math.min((value / max) * 100, 100);
  const remaining = 100 - percentage;

  // Theme-aware background color
  const getBackgroundColor = () => {
    if (backgroundColor) return backgroundColor;

    if (!mounted) return "#e5e7eb"; // Default fallback

    const currentTheme = resolvedTheme || theme;
    return currentTheme === "dark" ? "#374151" : "#e5e7eb"; // gray-700 for dark, gray-200 for light
  };

  const data = {
    datasets: [
      {
        data: [percentage, remaining],
        backgroundColor: [color, getBackgroundColor()],
        borderWidth: 0,
        cutout: size === "sm" ? "75%" : size === "md" ? "70%" : "65%",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return <div className={`relative ${sizeClasses[size]} ${className}`} />;
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <Doughnut data={data} options={options} />
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
