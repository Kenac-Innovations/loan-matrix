"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PipelineFunnelChartProps {
  stageData?: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  className?: string;
}

export function PipelineFunnelChart({
  stageData = [
    { name: "Lead Qualification", count: 2, color: "#3B82F6" },
    { name: "Document Collection", count: 1, color: "#A855F7" },
    { name: "Credit Assessment", count: 2, color: "#EAB308" },
    { name: "Approval", count: 1, color: "#22C55E" },
    { name: "Disbursement", count: 1, color: "#14B8A6" },
  ],
  className = "",
}: PipelineFunnelChartProps) {
  const data = {
    labels: stageData.map((stage) => stage.name),
    datasets: [
      {
        label: "Leads",
        data: stageData.map((stage) => stage.count),
        backgroundColor: stageData.map((stage) => stage.color + "CC"), // Add transparency
        borderColor: stageData.map((stage) => stage.color),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
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
            const total = stageData.reduce(
              (sum, stage) => sum + stage.count,
              0
            );
            const percentage = ((context.parsed.x / total) * 100).toFixed(1);
            return `${context.parsed.x} leads (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: "#9CA3AF",
          font: {
            size: 11,
          },
          stepSize: 1,
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
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className={`h-full w-full ${className}`}>
      <Bar data={data} options={options} />
    </div>
  );
}
