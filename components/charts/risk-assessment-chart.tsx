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
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface RiskAssessmentChartProps {
  type?: "doughnut" | "bar";
  className?: string;
}

export function RiskAssessmentChart({
  type = "doughnut",
  className = "",
}: RiskAssessmentChartProps) {
  const data = {
    labels: ["Low Risk", "Medium Risk", "High Risk"],
    datasets: [
      {
        label: "Risk Distribution",
        data: [68, 24, 8],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)", // green
          "rgba(251, 191, 36, 0.8)", // yellow
          "rgba(239, 68, 68, 0.8)", // red
        ],
        borderColor: [
          "rgba(34, 197, 94, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(239, 68, 68, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#9CA3AF",
          font: {
            size: 11,
          },
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "#1F2937",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        borderColor: "#374151",
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return `${context.label}: ${context.parsed}%`;
          },
        },
      },
    },
  };

  const barOptions = {
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
            return `${context.label}: ${context.parsed.y}%`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9CA3AF",
          font: {
            size: 10,
          },
        },
        grid: {
          color: "#374151",
        },
      },
      y: {
        ticks: {
          color: "#9CA3AF",
          font: {
            size: 10,
          },
          callback: function (value: any) {
            return value + "%";
          },
        },
        grid: {
          color: "#374151",
        },
        max: 100,
      },
    },
  };

  if (type === "bar") {
    return (
      <div className={`h-full w-full ${className}`}>
        <Bar data={data} options={barOptions} />
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <Doughnut data={data} options={doughnutOptions} />
    </div>
  );
}
