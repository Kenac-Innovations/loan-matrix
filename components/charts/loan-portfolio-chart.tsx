"use client";

import { useEffect, useRef } from "react";
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

interface LoanPortfolioChartProps {
  type?: "bar" | "doughnut";
  className?: string;
}

export function LoanPortfolioChart({
  type = "bar",
  className = "",
}: LoanPortfolioChartProps) {
  const chartRef = useRef<ChartJS | null>(null);

  // Sample data for loan portfolio
  const data = {
    labels: [
      "Personal Loans",
      "Business Loans",
      "Mortgages",
      "Auto Loans",
      "Student Loans",
    ],
    datasets: [
      {
        label: "Loan Amount ($)",
        data: [1200000, 2800000, 3500000, 850000, 450000],
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)", // blue
          "rgba(168, 85, 247, 0.8)", // purple
          "rgba(34, 197, 94, 0.8)", // green
          "rgba(251, 191, 36, 0.8)", // yellow
          "rgba(239, 68, 68, 0.8)", // red
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(168, 85, 247, 1)",
          "rgba(34, 197, 94, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(239, 68, 68, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#9CA3AF",
          font: {
            size: 12,
          },
        },
      },
      title: {
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
            return `${
              context.dataset.label
            }: $${context.parsed.y.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9CA3AF",
          font: {
            size: 11,
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
            size: 11,
          },
          callback: function (value: any) {
            return "$" + (value / 1000000).toFixed(1) + "M";
          },
        },
        grid: {
          color: "#374151",
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: "#9CA3AF",
          font: {
            size: 12,
          },
          usePointStyle: true,
          padding: 20,
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
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0
            );
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${
              context.label
            }: $${context.parsed.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  if (type === "doughnut") {
    return (
      <div className={`h-full w-full ${className}`}>
        <Doughnut data={data} options={doughnutOptions} />
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <Bar data={data} options={barOptions} />
    </div>
  );
}
