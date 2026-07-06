import Link from "next/link";
import {
  BriefcaseBusiness,
  ClipboardList,
  History,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const systemAreas = [
  {
    title: "Roles & Permissions",
    description: "Create roles, maintain role status, and assign Fineract permissions.",
    href: "/system/roles-and-permissions",
    icon: ShieldCheck,
  },
  {
    title: "Manage Jobs",
    description: "Control scheduler jobs, workflow steps, COB catch-up, and inline COB runs.",
    href: "/system/manage-jobs",
    icon: BriefcaseBusiness,
  },
  {
    title: "Audit Trails",
    description: "Search maker-checker activity, inspect command payloads, and export results.",
    href: "/system/audit-trails",
    icon: History,
  },
  {
    title: "Configure Maker Checker Tasks",
    description: "Enable or disable maker-checker handling for eligible Fineract tasks.",
    href: "/system/configure-mc-tasks",
    icon: ClipboardList,
  },
];

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System</h1>
        <p className="mt-1 text-muted-foreground">
          Administrative tools backed directly by the signed-in Fineract user session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {systemAreas.map((area) => {
          const Icon = area.icon;

          return (
            <Link key={area.href} href={area.href}>
              <Card className="h-full rounded-lg transition-colors hover:border-primary/60 hover:bg-muted/30">
                <CardContent className="flex h-full gap-4 p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{area.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {area.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
