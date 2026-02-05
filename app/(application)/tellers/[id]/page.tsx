import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building, Calendar, Users, DollarSign, History } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-currency";
import { TellerActions } from "./components/teller-actions";
import { getTellerFromFineract } from "@/app/actions/teller-actions";

// Force dynamic rendering to always fetch fresh data from Fineract
export const dynamic = "force-dynamic";

export default async function TellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTellerFromFineract(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const teller = result.data;

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      PENDING: "bg-yellow-500",
      CLOSED: "bg-gray-500",
    };

    return (
      <Badge className={colors[status] ? `${colors[status]} text-white` : ""}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tellers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{teller.name}</h1>
            <p className="text-muted-foreground mt-1">
              {teller.description || "Teller details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(teller.status)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teller.currentAllocation
                ? formatCurrency(
                    teller.currentAllocation.amount,
                    teller.currentAllocation.currency
                  )
                : "No allocation"}
            </div>
            {teller.vaultBalance !== undefined && (
              <div className="text-xs text-muted-foreground mt-1">
                Vault: {formatCurrency(teller.vaultBalance, teller.currency || "ZMW")}
                {teller.allocatedToCashiers > 0 && (
                  <span className="ml-2">
                    • Allocated: {formatCurrency(teller.allocatedToCashiers, teller.currency || "ZMW")}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Start Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {(() => {
                // Handle Fineract date formats: array [year, month, day] or string
                if (Array.isArray(teller.startDate)) {
                  return formatDate(teller.startDate);
                } else if (teller.startDate) {
                  const date = new Date(teller.startDate);
                  if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  }
                }
                return <span className="text-muted-foreground">—</span>;
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4" />
              Office
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teller.officeName || "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cashiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teller.cashiers?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {teller.activeCashiers || 0} active
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teller Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Teller ID</div>
                <div className="font-medium">{teller.id}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Office</div>
                <div className="font-medium">{teller.officeName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div>{getStatusBadge(teller.status)}</div>
              </div>
              {teller.endDate && (
                <div>
                  <div className="text-sm text-muted-foreground">End Date</div>
                  <div className="font-medium">
                    {(() => {
                      // Handle Fineract date formats: array [year, month, day] or string
                      if (Array.isArray(teller.endDate)) {
                        return formatDate(teller.endDate);
                      } else if (teller.endDate) {
                        const date = new Date(teller.endDate);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          });
                        }
                      }
                      return <span className="text-muted-foreground">—</span>;
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cashiers List */}
          {teller.cashiers && teller.cashiers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cashiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teller.cashiers.map((cashier: any) => (
                    <div
                      key={cashier.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{cashier.staffName || `Cashier ${cashier.id}`}</div>
                        <div className="text-sm text-muted-foreground">
                          {cashier.isFullDay ? "Full Day" : cashier.startTime ? `${cashier.startTime} - ${cashier.endTime}` : "No schedule"}
                        </div>
                      </div>
                      <Badge variant={cashier.isFullDay || cashier.startTime ? "default" : "secondary"}>
                        {cashier.isFullDay || cashier.startTime ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state for cashiers */}
          {(!teller.cashiers || teller.cashiers.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Cashiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No cashiers assigned to this teller</p>
                  <Link href={`/tellers/${id}/cashiers`}>
                    <Button variant="outline" className="mt-3">
                      Manage Cashiers
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Settlements */}
          {teller.recentSettlements && teller.recentSettlements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Settlements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teller.recentSettlements.map((settlement: any) => (
                    <div
                      key={settlement.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {(() => {
                            if (Array.isArray(settlement.settlementDate)) {
                              return formatDate(settlement.settlementDate);
                            } else if (settlement.settlementDate) {
                              const date = new Date(settlement.settlementDate);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                });
                              }
                            }
                            return "—";
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {settlement.notes || "No notes"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(settlement.closingBalance, teller.currency || "ZMW")}
                        </div>
                        <div
                          className={`text-sm ${
                            settlement.difference >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {settlement.difference >= 0 ? "+" : ""}
                          {formatCurrency(settlement.difference, teller.currency || "ZMW")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vault Transactions Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Vault Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                View all cash movements in and out of the teller vault, including opening balances, bank allocations, and settlement returns.
              </p>
              <Link href={`/tellers/${id}/transactions`}>
                <Button>
                  <History className="h-4 w-4 mr-2" />
                  View Transactions
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <TellerActions
                tellerId={id}
                tellerName={teller.name}
                teller={teller}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
