"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UssdLeadsMetrics as UssdLeadsMetricsType } from "@/app/actions/ussd-leads-actions";
import { 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Users,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UssdLeadsMetricsProps {
  metrics: UssdLeadsMetricsType;
  className?: string;
}

export function UssdLeadsMetrics({ metrics, className }: UssdLeadsMetricsProps) {
  const cards = [
    {
      title: "Total Applications",
      value: metrics.totalApplications,
      description: "All time applications",
      icon: Phone,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Pending Action",
      value: metrics.pendingAction,
      description: "Need review",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Approved",
      value: metrics.approved,
      description: "Applications approved",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Rejected",
      value: metrics.rejected,
      description: "Applications rejected",
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Disbursed",
      value: metrics.disbursed,
      description: "Loans disbursed",
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Under Review",
      value: metrics.underReview,
      description: "Currently reviewing",
      icon: Users,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Approval Rate",
      value: `${metrics.approvalRate}%`,
      description: "Success rate",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Avg Processing Time",
      value: `${metrics.averageProcessingTime}h`,
      description: "Time to process",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={cn("p-2 rounded-full", card.bgColor)}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", card.color)}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


