// components/accounting/StatsCards.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Stat {
  title: string;
  value: string | number;
  delta?: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  description?: string;
  trend?: "up" | "down" | "neutral";
}

export default function StatsCards({ stats }: { stats: Stat[] }) {
  const getTrendIcon = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
    }
  };

  const getTrendColor = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400";
      case "down":
        return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map(({ title, value, delta, icon: Icon, description, trend }) => (
        <Card key={title} className="hover:shadow-lg transition-all duration-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md bg-white dark:bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {title}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
            {description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {description}
              </p>
            )}
            {delta && delta !== "—" && (
              <div className="flex items-center gap-1 mt-2">
                {getTrendIcon(trend)}
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-medium ${getTrendColor(trend)}`}
                >
                  {delta}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
