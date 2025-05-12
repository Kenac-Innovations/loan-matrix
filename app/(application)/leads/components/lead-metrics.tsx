"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";

interface LeadMetricsProps {
  className?: string;
}

export function LeadMetrics({ className }: LeadMetricsProps) {
  return (
    <div
      className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      <Card className="bg-[#0d121f] text-white border-[#1a2035]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">42</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-green-400">+12% from last month</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Monthly Target: 50</span>
              <span>84%</span>
            </div>
            <Progress
              value={84}
              className="h-1.5 bg-[#1a2035]"
              indicatorClassName="bg-green-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0d121f] text-white border-[#1a2035]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">68%</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-red-400">-3% from last month</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Monthly Target: 75%</span>
              <span>91%</span>
            </div>
            <Progress
              value={91}
              className="h-1.5 bg-[#1a2035]"
              indicatorClassName="bg-yellow-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0d121f] text-white border-[#1a2035]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Avg. Processing Time
          </CardTitle>
          <Clock className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">8.5 days</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-green-400">
              -0.8 days from last month
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Target: 10 days</span>
              <span>85%</span>
            </div>
            <Progress
              value={85}
              className="h-1.5 bg-[#1a2035]"
              indicatorClassName="bg-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0d121f] text-white border-[#1a2035]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">92%</div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-green-400">+4% from last month</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>On Time (38)</span>
              </div>
              <span>90%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                <span>At Risk (2)</span>
              </div>
              <span>5%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span>Overdue (2)</span>
              </div>
              <span>5%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
