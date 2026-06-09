"use client";

import { useState, useTransition } from "react";
import { Ban, Building2, PenLine, ShieldCheck, UserRound } from "lucide-react";
import { getUserBlockHistoryAction } from "@/app/actions/user-management-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPhoneWithCountryCode } from "@/lib/phone-utils";
import { isHeadOfficeOffice } from "@/shared/user-management/lead-branch-visibility";
import type {
  UserBlockHistoryPage,
  UserDetail,
  UserLoginBlockEvent,
} from "@/shared/types/user-management";

interface UserDetailTabsProps {
  user: UserDetail;
  signatureData: string | null;
  restrictLeadVisibilityToBranches: boolean;
}

function DetailField({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

function formatAuditTimestamp(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getBlockSourceLabel(event: UserLoginBlockEvent | { source?: string | null }) {
  return event.source === "SYSTEM_MFA_MAX_ATTEMPTS"
    ? "System: MFA attempts"
    : "Manual admin action";
}

function BlockHistorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`block-history-skeleton-${index}`}
            className="rounded-lg border p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-36" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BlockHistoryContent({
  username,
  historyPage,
  onPageChange,
  isLoading,
}: Readonly<{
  username: string;
  historyPage: UserBlockHistoryPage;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}>) {
  const startItem =
    historyPage.total === 0
      ? 0
      : (historyPage.page - 1) * historyPage.pageSize + 1;
  const endItem =
    historyPage.total === 0
      ? 0
      : Math.min(historyPage.page * historyPage.pageSize, historyPage.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Block History</CardTitle>
        <CardDescription>
          Audit trail for account block and unblock actions on @{username}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {historyPage.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No block or unblock events have been recorded for this user.
          </p>
        ) : (
          <div className="space-y-3">
            {historyPage.items.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          event.action === "BLOCK"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {event.action === "BLOCK" ? "Blocked" : "Unblocked"}
                      </Badge>
                      <Badge variant="outline">
                        {getBlockSourceLabel(event)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {event.actorName || "System"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatAuditTimestamp(event.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm">{event.note}</p>
              </div>
            ))}
          </div>
        )}

        {historyPage.total > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startItem}-{endItem} of {historyPage.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(historyPage.page - 1)}
                disabled={historyPage.page <= 1 || isLoading}
              >
                Previous
              </Button>
              <p className="min-w-24 text-center text-sm text-muted-foreground">
                Page {historyPage.page} of {historyPage.totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(historyPage.page + 1)}
                disabled={historyPage.page >= historyPage.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UserDetailTabs({
  user,
  signatureData,
  restrictLeadVisibilityToBranches,
}: Readonly<UserDetailTabsProps>) {
  const [activeTab, setActiveTab] = useState("details");
  const [blockHistoryPage, setBlockHistoryPage] = useState<UserBlockHistoryPage | null>(
    null
  );
  const [blockHistoryError, setBlockHistoryError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const phoneDisplay =
    formatPhoneWithCountryCode(user.phone, user.countryCode) || "Not set";
  const hasHeadOfficeVisibility = user.visibleLeadOffices.some((office) =>
    isHeadOfficeOffice(office)
  );

  const loadBlockHistoryPage = (page: number) => {
    if (
      page < 1 ||
      isPending ||
      (blockHistoryPage !== null && page === blockHistoryPage.page)
    ) {
      return;
    }

    setBlockHistoryError(null);
    startTransition(async () => {
      try {
        const historyPage = await getUserBlockHistoryAction({
          userId: user.id,
          page,
        });
        setBlockHistoryPage(historyPage);
      } catch (error) {
        setBlockHistoryError(
          error instanceof Error
            ? error.message
            : "Failed to load block history"
        );
      }
    });
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (value !== "mfa" || blockHistoryPage !== null || isPending) {
      return;
    }

    loadBlockHistoryPage(1);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <TabsList className="grid w-full max-w-lg grid-cols-3">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="lead-access">Lead Access</TabsTrigger>
        <TabsTrigger value="mfa">MFA</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              User Information
            </CardTitle>
            <CardDescription>
              Core user details from the Mifos user profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Login Name" value={user.username} />
            <DetailField label="First Name" value={user.firstname} />
            <DetailField label="Last Name" value={user.lastname} />
            <DetailField label="Email" value={user.email || "Not set"} />
            <DetailField label="Phone" value={phoneDisplay} />
            <DetailField label="Office" value={user.officeName || "-"} />
            <DetailField
              label="Staff"
              value={user.staff?.displayName || "Unassigned"}
            />
            <DetailField
              label="Password Never Expires"
              value={user.passwordNeverExpires ? "Yes" : "No"}
            />
            <DetailField
              label="Self Service User"
              value={user.isSelfServiceUser ? "Yes" : "No"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              User Signature
            </CardTitle>
            <CardDescription>
              Saved signature used for this user&apos;s loan contract workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signatureData ? (
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureData}
                  alt={`${user.displayName} signature`}
                  className="mx-auto max-h-32 rounded border bg-white p-2"
                />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                <PenLine className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No signature has been saved for this user.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Assigned Roles
            </CardTitle>
            <CardDescription>
              Roles currently attached to this user in Fineract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.selectedRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No roles assigned to this user.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.selectedRoles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="lead-access" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lead Configuration
            </CardTitle>
            <CardDescription>
              Lead-specific access and disbursement settings for this user.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField
              label="Can Override Designated Disburser"
              value={user.canOverrideInitiatorDisbursement ? "Yes" : "No"}
            />
            <DetailField
              label="Lead Visibility"
              value={
                restrictLeadVisibilityToBranches
                  ? "Restricted by selected branches"
                  : "All leads visible"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visible Lead Branches</CardTitle>
            <CardDescription>
              {restrictLeadVisibilityToBranches
                ? "These branch selections control which leads this user can view."
                : "Branch-based lead visibility is disabled for this tenant."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!restrictLeadVisibilityToBranches ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                This tenant is not using branch-based lead visibility. The user can
                view all leads allowed by the rest of the system.
              </div>
            ) : user.visibleLeadOffices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No branches are assigned. This user will not be able to view
                branch-scoped leads until branches are configured.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {user.visibleLeadOffices.map((office) => (
                    <Badge key={office.id} variant="outline">
                      {office.name}
                    </Badge>
                  ))}
                </div>

                {hasHeadOfficeVisibility && (
                  <p className="text-sm text-muted-foreground">
                    Head Office grants visibility across all branches.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mfa" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Account Access
            </CardTitle>
            <CardDescription>
              MFA lock status and the latest block metadata for this account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField
              label="Account Status"
              value={user.isBlocked ? "Blocked" : "Active"}
            />
            <DetailField
              label="Blocked At"
              value={formatAuditTimestamp(user.blockedAt)}
            />
            <DetailField
              label="Block Source"
              value={
                user.isBlocked || user.blockedSource
                  ? getBlockSourceLabel({ source: user.blockedSource })
                  : "Not blocked"
              }
            />
            <DetailField
              label="Last Changed By"
              value={user.blockedByActorName || (user.isBlocked ? "System" : "-")}
            />
            <div className="space-y-1 rounded-lg border p-4 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                Latest Note
              </p>
              <p className="font-medium">{user.blockedNote || "No note recorded"}</p>
            </div>
          </CardContent>
        </Card>

        {isPending ? (
          <BlockHistorySkeleton />
        ) : blockHistoryError ? (
          <Card>
            <CardHeader>
              <CardTitle>Block History</CardTitle>
              <CardDescription>
                Audit trail for account block and unblock actions on @{user.username}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{blockHistoryError}</p>
            </CardContent>
          </Card>
        ) : (
          <BlockHistoryContent
            username={user.username}
            historyPage={
              blockHistoryPage ?? {
                items: [],
                page: 1,
                pageSize: 5,
                total: 0,
                totalPages: 1,
              }
            }
            onPageChange={loadBlockHistoryPage}
            isLoading={isPending}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
