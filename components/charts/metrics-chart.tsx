"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface MetricsChartProps {
  type: "progress" | "sla-breakdown";
  data?: any;
  className?: string;
}

export function MetricsChart({
  type,
  data,
  className = "",
}: MetricsChartProps) {
  if (type === "progress") {
    const progressData = {
      labels: ["Current", "Target"],
      datasets: [
        {
          label: "Progress",
          data: [data?.current || 84, data?.target || 100],
          backgroundColor: ["#22C55E", "#1a2035"],
          borderColor: ["#16A34A", "#374151"],
          borderWidth: 1,
        },
      ],
    };

    const progressOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#1F2937",
          titleColor: "#F9FAFB",
          bodyColor: "#F9FAFB",
          borderColor: "#374151",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
          max: 100,
        },
      },
    };

    return (
      <div className={`h-8 ${className}`}>
        <Bar data={progressData} options={progressOptions} />
      </div>
    );
  }

  if (type === "sla-breakdown") {
    // Use real data if provided, otherwise use defaults
    const onTimeCount = data?.onTimeCount || 0;
    const atRiskCount = data?.atRiskCount || 0;
    const overdueCount = data?.overdueCount || 0;
    const totalCount = onTimeCount + atRiskCount + overdueCount;

    // Calculate percentages, handle case where total is 0
    const onTimePercent =
      totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0;
    const atRiskPercent =
      totalCount > 0 ? Math.round((atRiskCount / totalCount) * 100) : 0;
    const overduePercent =
      totalCount > 0 ? Math.round((overdueCount / totalCount) * 100) : 0;

    // If no data, show a single segment
    const chartData =
      totalCount > 0 ? [onTimePercent, atRiskPercent, overduePercent] : [100]; // Show full circle when no data

    const chartLabels =
      totalCount > 0 ? ["On Time", "At Risk", "Overdue"] : ["No Data"];

    const chartColors =
      totalCount > 0 ? ["#22C55E", "#EAB308", "#EF4444"] : ["#6B7280"]; // Gray for no data

    const slaData = {
      labels: chartLabels,
      datasets: [
        {
          data: chartData,
          backgroundColor: chartColors,
          borderWidth: 0,
        },
      ],
    };

    const slaOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#1F2937",
          titleColor: "#F9FAFB",
          bodyColor: "#F9FAFB",
          borderColor: "#374151",
          borderWidth: 1,
          callbacks: {
            label: function (context: any) {
              if (totalCount === 0) {
                return "No leads data";
              }
              return `${context.label}: ${context.parsed}%`;
            },
          },
        },
      },
    };

    return (
      <div className={`h-16 w-16 ${className}`}>
        <Doughnut data={slaData} options={slaOptions} />
      </div>
    );
  }

  return null;
}
