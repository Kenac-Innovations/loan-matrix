"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Users,
  Plus,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Edit,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { AllocateFundsModal } from "../components/allocate-funds-modal";
import { AssignTellerModal } from "../components/assign-teller-modal";
import { EditBankModal } from "../components/edit-bank-modal";

interface Bank {
  id: string;
  name: string;
  code: string;
  description?: string;
  officeId?: number;
  officeName?: string;
  status: string;
  isActive: boolean;
  totalAllocated: number;
  allocatedToTellers: number;
  availableBalance: number;
  currency: string;
  tellers: Teller[];
  allocations: Allocation[];
}

interface Teller {
  id: string;
  name: string;
  fineractTellerId?: number;
  officeName: string;
  status: string;
  vaultBalance: number;
  activeCashiers: number;
}

interface Allocation {
  id: string;
  amount: number;
  currency: string;
  allocatedDate: string;
  allocatedBy: string;
  notes?: string;
  status: string;
}

export default function BankDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bank, setBank] = useState<Bank | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [assignTellerModalOpen, setAssignTellerModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    fetchBank();
  }, [id]);

  const fetchBank = async () => {
    try {
      const response = await fetch(`/api/banks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setBank(data);
      } else {
        router.push("/banks");
      }
    } catch (error) {
      console.error("Error fetching bank:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      INACTIVE: "bg-yellow-500",
      CLOSED: "bg-gray-500",
      PENDING: "bg-blue-500",
    };

    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading bank details...</div>
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Bank not found</div>
      </div>
    );
  }

  const utilizationPercent =
    bank.totalAllocated > 0
      ? ((bank.allocatedToTellers / bank.totalAllocated) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/banks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{bank.name}</h1>
              {getStatusBadge(bank.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              Code: {bank.code} {bank.officeName && `• ${bank.officeName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignTellerModalOpen(true)}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Assign Teller
          </Button>
          <Button size="sm" onClick={() => setAllocateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Allocate Funds
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Funds</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(bank.totalAllocated, bank.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total allocated to this bank
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(bank.availableBalance, bank.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready to allocate to tellers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Allocated to Tellers
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(bank.allocatedToTellers, bank.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {utilizationPercent}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tellers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bank.tellers.length}</div>
            <p className="text-xs text-muted-foreground">
              Connected to this bank
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tellers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tellers</CardTitle>
              <CardDescription>
                Tellers connected to this bank and their balances
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignTellerModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Teller
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bank.tellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tellers assigned to this bank yet. Click "Assign Teller" to add
              one.
            </div>
          ) : (
            <div className="space-y-4">
              {bank.tellers.map((teller) => (
                <div
                  key={teller.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/tellers/${teller.fineractTellerId || teller.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{teller.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {teller.officeName} • {teller.activeCashiers} cashiers
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(teller.vaultBalance, bank.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vault balance
                      </div>
                    </div>
                    {getStatusBadge(teller.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/tellers/${teller.fineractTellerId || teller.id}`);
                          }}
                        >
                          View Teller
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/tellers/${teller.fineractTellerId || teller.id}/cashiers`);
                          }}
                        >
                          Manage Cashiers
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Allocations</CardTitle>
          <CardDescription>
            Recent fund allocations to this bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bank.allocations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No allocations yet. Click "Allocate Funds" to add funds to this
              bank.
            </div>
          ) : (
            <div className="space-y-3">
              {bank.allocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        allocation.status === "ACTIVE"
                          ? "bg-green-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <DollarSign
                        className={`h-4 w-4 ${
                          allocation.status === "ACTIVE"
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="font-medium">
                        +{formatCurrency(allocation.amount, allocation.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(new Date(allocation.allocatedDate))}
                        {allocation.notes && ` • ${allocation.notes}`}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      allocation.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {allocation.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AllocateFundsModal
        open={allocateModalOpen}
        onOpenChange={setAllocateModalOpen}
        bankId={bank.id}
        bankName={bank.name}
        onSuccess={fetchBank}
      />
      <AssignTellerModal
        open={assignTellerModalOpen}
        onOpenChange={setAssignTellerModalOpen}
        bankId={bank.id}
        bankName={bank.name}
        onSuccess={fetchBank}
      />
      <EditBankModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        bank={bank}
        onSuccess={fetchBank}
      />
    </div>
  );
}

