"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface ConversionMetricsChartProps {
  data?: {
    labels: string[];
    conversionRates: number[];
  };
  className?: string;
}

export function ConversionMetricsChart({
  data = {
    labels: [
      "Qualification → Documents",
      "Documents → Assessment",
      "Assessment → Approval",
      "Approval → Disbursement",
    ],
    conversionRates: [85, 78, 65, 95],
  },
  className = "",
}: ConversionMetricsChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: "Conversion Rate (%)",
        data: data.conversionRates,
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#3B82F6",
        pointBorderColor: "#1E40AF",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
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
        backgroundColor: "#1F2937",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        borderColor: "#374151",
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return `Conversion Rate: ${context.parsed.y}%`;
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
          maxRotation: 45,
        },
        grid: {
          color: "#374151",
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "#9CA3AF",
          font: {
            size: 11,
          },
          callback: function (value: any) {
            return value + "%";
          },
        },
        grid: {
          color: "#374151",
        },
      },
    },
  };

  return (
    <div className={`h-full w-full ${className}`}>
      <Line data={chartData} options={options} />
    </div>
  );
}
