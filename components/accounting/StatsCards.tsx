// components/accounting/StatsCards.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, ListChecks, RefreshCcw } from "lucide-react";

interface Stat {
  title: string;
  value: string | number;
  delta?: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export default function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {stats.map(({ title, value, delta, icon: Icon }) => (
        <Card key={title}>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{title}</p>
              <p className="text-2xl font-semibold">{value}</p>
              {delta && <p className="text-xs text-green-600 mt-1">{delta}</p>}
            </div>
            <Icon className="w-8 h-8 text-gray-300" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
