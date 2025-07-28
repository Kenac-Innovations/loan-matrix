import { useTheme } from "next-themes";

export interface ChartThemeColors {
  background: string;
  border: string;
  text: string;
  grid: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
}

export function getChartThemeColors(
  theme: string | undefined
): ChartThemeColors {
  const isDark = theme === "dark";

  return {
    background: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
    border: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
    text: isDark ? "#ffffff" : "#000000",
    grid: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.1)",
    success: isDark ? "rgba(34, 197, 94, 0.8)" : "rgba(34, 197, 94, 0.8)",
    warning: isDark ? "rgba(251, 191, 36, 0.8)" : "rgba(251, 191, 36, 0.8)",
    error: isDark ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.8)",
    info: isDark ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 0.8)",
    muted: isDark ? "rgba(156, 163, 175, 0.3)" : "rgba(229, 231, 235, 0.3)",
  };
}

export function getChartOptions(
  theme: string | undefined,
  customOptions: any = {}
) {
  const colors = getChartThemeColors(theme);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: colors.text,
        },
        ...customOptions.plugins?.legend,
      },
      tooltip: {
        backgroundColor:
          theme === "dark" ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)",
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.border,
        borderWidth: 1,
        ...customOptions.plugins?.tooltip,
      },
    },
    ...customOptions,
  };

  // Only add scales if they're not explicitly disabled
  if (customOptions.scales !== false) {
    baseOptions.scales = {
      x: {
        ticks: {
          color: colors.text,
        },
        grid: {
          color: colors.grid,
        },
        ...customOptions.scales?.x,
      },
      y: {
        ticks: {
          color: colors.text,
        },
        grid: {
          color: colors.grid,
        },
        ...customOptions.scales?.y,
      },
      r: {
        angleLines: {
          color: colors.grid,
        },
        grid: {
          color: colors.grid,
        },
        pointLabels: {
          color: colors.text,
          font: {
            size: 10,
          },
        },
        ticks: {
          display: false,
          color: colors.text,
          backdropColor: "transparent",
        },
        ...customOptions.scales?.r,
      },
    };
  }

  return baseOptions;
}

export function useChartTheme() {
  const { theme } = useTheme();
  const colors = getChartThemeColors(theme);

  return {
    colors,
    getOptions: (customOptions: any = {}) =>
      getChartOptions(theme, customOptions),
  };
}
