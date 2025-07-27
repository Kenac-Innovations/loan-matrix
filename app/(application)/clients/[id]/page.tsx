import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  DollarSign,
  AlertCircle,
  FileText,
  Activity,
  Edit,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientDetails } from "./components/client-details";
import { ClientLoans } from "./components/client-loans";
import { ClientTransactions } from "./components/client-transactions";
import { ClientDocuments } from "./components/client-documents";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const clientId = parseInt(id);

  if (isNaN(clientId)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Client Details</h1>
          <p className="text-muted-foreground">
            View and manage client information
          </p>
        </div>
        <Button size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit Client
        </Button>
      </div>

      {/* Client Overview */}
      <Suspense fallback={<div>Loading client details...</div>}>
        <ClientDetails clientId={clientId} />
      </Suspense>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <Suspense fallback={<div>Loading loans...</div>}>
            <ClientLoans clientId={clientId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Suspense fallback={<div>Loading transactions...</div>}>
            <ClientTransactions clientId={clientId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Suspense fallback={<div>Loading documents...</div>}>
            <ClientDocuments clientId={clientId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Timeline of client interactions and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-500/20 p-1.5">
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Client activated</p>
                    <p className="text-xs text-muted-foreground">
                      Client account was successfully activated
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Today, 09:42 AM
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/20 p-1.5">
                    <CreditCard className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Loan application submitted
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New loan application for $50,000 submitted
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Yesterday, 2:30 PM
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-purple-500/20 p-1.5">
                    <FileText className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Documents uploaded</p>
                    <p className="text-xs text-muted-foreground">
                      KYC documents uploaded and verified
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      2 days ago, 11:15 AM
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
