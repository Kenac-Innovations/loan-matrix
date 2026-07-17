"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type UssdUser = {
  userId: number;
  fullName: string;
  nationalIdMask?: string | null;
  phoneNumber: string;
  otherPhoneNumber?: string | null;
  active?: boolean;
};

type ResetLog = {
  id: string;
  phoneNumber: string;
  ussdUserId?: number | null;
  clientName?: string | null;
  nationalIdMask?: string | null;
  actorUserId: number;
  actorName?: string | null;
  reason: string;
  status: string;
  ussdStatus?: string | null;
  responseMessage?: string | null;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

type Notice = {
  type: "success" | "error";
  title: string;
  message: string;
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  return data as Record<string, unknown>;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  if (normalized === "SUCCESS" || normalized === "FLAGGED") {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800">
        {status}
      </Badge>
    );
  }

  if (normalized === "FLAGGED_SMS_FAILED") {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-800">
        {status}
      </Badge>
    );
  }

  if (normalized === "PENDING") {
    return <Badge variant="secondary">{status}</Badge>;
  }

  return <Badge variant="destructive">{status}</Badge>;
}

async function fetchResetLogs() {
  const response = await fetch("/api/ussd-pin-reset/logs?limit=25");
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(String(data.error || "Failed to load PIN change logs"));
  }

  return Array.isArray(data.logs) ? (data.logs as ResetLog[]) : [];
}

export function UssdPinResetClient() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reason, setReason] = useState("");
  const [user, setUser] = useState<UssdUser | null>(null);
  const [logs, setLogs] = useState<ResetLog[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const selectedPhoneNumber = useMemo(
    () => user?.phoneNumber || phoneNumber,
    [phoneNumber, user?.phoneNumber]
  );

  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      setLogs(await fetchResetLogs());
    } catch (error) {
      setNotice({
        type: "error",
        title: "Log refresh failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load PIN change logs",
      });
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialLogs() {
      try {
        const nextLogs = await fetchResetLogs();

        if (isMounted) {
          setLogs(nextLogs);
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            type: "error",
            title: "Log refresh failed",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load PIN change logs",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingLogs(false);
        }
      }
    }

    void loadInitialLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setUser(null);
    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/ussd-pin-reset/lookup?phoneNumber=${encodeURIComponent(
          phoneNumber
        )}`
      );
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || "USSD user not found"));
      }

      setUser(data.user as UssdUser);
    } catch (error) {
      setNotice({
        type: "error",
        title: "Search failed",
        message:
          error instanceof Error ? error.message : "Failed to search USSD user",
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleReset() {
    if (!user) {
      setNotice({
        type: "error",
        title: "No client selected",
        message: "Search and select a USSD client before requiring a PIN change.",
      });
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setNotice({
        type: "error",
        title: "Reason required",
        message: "Enter a reset reason before continuing.",
      });
      return;
    }

    setNotice(null);
    setIsResetting(true);

    try {
      const response = await fetch("/api/ussd-pin-reset/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: selectedPhoneNumber,
          reason: trimmedReason,
        }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || "PIN change request failed"));
      }

      setNotice({
        type: "success",
        title: "PIN change requested",
        message: String(
          data.message ||
            "The client will be prompted to set a new PIN in USSD."
        ),
      });
      setReason("");
      await loadLogs();
    } catch (error) {
      setNotice({
        type: "error",
        title: "PIN change request failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to require USSD PIN change",
      });
      await loadLogs();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.type === "error" ? "destructive" : "default"}>
          {notice.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <form className="space-y-3" onSubmit={handleSearch}>
            <div className="space-y-2">
              <Label htmlFor="ussd-phone-number">Phone number</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ussd-phone-number"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="0977123456"
                  inputMode="tel"
                  disabled={isSearching || isResetting}
                />
                <Button
                  type="submit"
                  disabled={isSearching || isResetting || !phoneNumber.trim()}
                >
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>
          </form>

          {user && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{user.fullName}</h3>
                  <p className="text-sm text-muted-foreground">
                    USSD user #{user.userId}
                  </p>
                </div>
                <Badge variant={user.active === false ? "destructive" : "secondary"}>
                  {user.active === false ? "Inactive" : "Active"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">National ID</p>
                  <p className="font-medium">{user.nationalIdMask || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Other phone</p>
                  <p className="font-medium">{user.otherPhoneNumber || "-"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-reason">Reason</Label>
                <Textarea
                  id="reset-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Client verified at branch"
                  rows={3}
                  disabled={isResetting}
                />
              </div>

              <Button
                type="button"
                onClick={handleReset}
                disabled={isResetting || !reason.trim()}
                className="w-full sm:w-auto"
              >
                {isResetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Require PIN Change
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Recent PIN changes</h3>
              <p className="text-sm text-muted-foreground">
                Staff-initiated USSD PIN change activity
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={isLoadingLogs}
            >
              {isLoadingLogs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No PIN change activity found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="font-medium">{log.clientName || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.nationalIdMask || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{log.phoneNumber}</TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                      {(log.responseMessage || log.errorMessage) && (
                        <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                          {log.responseMessage || log.errorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px] truncate" title={log.reason}>
                        {log.reason}
                      </div>
                    </TableCell>
                    <TableCell>{log.actorName || log.actorUserId}</TableCell>
                    <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
