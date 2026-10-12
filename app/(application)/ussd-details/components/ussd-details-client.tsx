"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AFRICAN_COUNTRY_CODES,
  DEFAULT_AFRICAN_COUNTRY_CODE,
  formatMobileForFineract,
  resolveCountryDialCodeForPhone,
} from "@/lib/phone-utils";

type UssdUser = {
  userId: number;
  fullName: string;
  externalId: number;
  phoneNumber: string;
};

type UpdateLog = {
  id: string;
  updateType: string;
  sourcePhoneNumber: string;
  requestedPhoneNumber: string;
  ussdUserId?: number | null;
  fineractClientId?: number | null;
  clientName?: string | null;
  actorUserId: number;
  actorName?: string | null;
  status: string;
  ussdStatus?: string | null;
  fineractStatus?: string | null;
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
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800">
        {status}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return <Badge variant="secondary">{status}</Badge>;
  }

  return <Badge variant="destructive">{status}</Badge>;
}

async function fetchUpdateLogs() {
  const response = await fetch("/api/ussd-client-details/logs?limit=25");
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(String(data.error || "Failed to load USSD update logs"));
  }

  return Array.isArray(data.logs) ? (data.logs as UpdateLog[]) : [];
}

export function UssdDetailsClient() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sourceCountryCode, setSourceCountryCode] = useState(
    DEFAULT_AFRICAN_COUNTRY_CODE
  );
  const [sourcePhoneNumber, setSourcePhoneNumber] = useState("");
  const [newCountryCode, setNewCountryCode] = useState(
    DEFAULT_AFRICAN_COUNTRY_CODE
  );
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [user, setUser] = useState<UssdUser | null>(null);
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [pageNotice, setPageNotice] = useState<Notice | null>(null);
  const [modalNotice, setModalNotice] = useState<Notice | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const sourceSearchNumber = useMemo(
    () => formatMobileForFineract(sourcePhoneNumber, sourceCountryCode),
    [sourceCountryCode, sourcePhoneNumber]
  );

  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      setLogs(await fetchUpdateLogs());
      setPageNotice(null);
    } catch (error) {
      setPageNotice({
        type: "error",
        title: "Log refresh failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load USSD update logs",
      });
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadLogs();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadLogs]);

  function resetDialog() {
    setSourceCountryCode(DEFAULT_AFRICAN_COUNTRY_CODE);
    setSourcePhoneNumber("");
    setNewCountryCode(DEFAULT_AFRICAN_COUNTRY_CODE);
    setNewPhoneNumber("");
    setUser(null);
    setModalNotice(null);
    setIsSearching(false);
    setIsSaving(false);
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      resetDialog();
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalNotice(null);
    setUser(null);
    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/ussd-client-details/lookup?phoneNumber=${encodeURIComponent(
          sourceSearchNumber
        )}`
      );
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(String(data.error || "USSD client not found"));
      }

      const matchedUser = data.user as UssdUser;
      setUser(matchedUser);
      setNewCountryCode(
        resolveCountryDialCodeForPhone(
          matchedUser.phoneNumber,
          undefined,
          sourceCountryCode
        )
      );
      setNewPhoneNumber("");
    } catch (error) {
      setModalNotice({
        type: "error",
        title: "Search failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to search USSD client",
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!user) {
      return;
    }

    setModalNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/ussd-client-details/update-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePhoneNumber: user.phoneNumber,
          countryCode: newCountryCode,
          phoneNumber: newPhoneNumber,
        }),
      });
      const data = await readJson(response);

      if (!response.ok || data.success !== true) {
        throw new Error(
          String(data.error || "USSD client phone update failed")
        );
      }

      setModalNotice({
        type: "success",
        title: "Phone numbers updated",
        message: String(
          data.message ||
            "USSD and Loan Matrix client phone numbers are now in sync."
        ),
      });
      setUser(null);
      await loadLogs();
    } catch (error) {
      setModalNotice({
        type: "error",
        title: "Phone update failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update the client phone number",
      });
      await loadLogs();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {pageNotice && (
        <Alert variant={pageNotice.type === "error" ? "destructive" : "default"}>
          {pageNotice.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{pageNotice.title}</AlertTitle>
          <AlertDescription>{pageNotice.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">USSD information updates</h3>
          <p className="text-sm text-muted-foreground">
            Recent staff-initiated phone updates and synchronization results.
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button type="button" onClick={() => setIsDialogOpen(true)}>
            <Phone className="mr-2 h-4 w-4" />
            Update info
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Phone update</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No USSD information updates found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="font-medium">{log.clientName || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      Client #{log.fineractClientId ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{log.sourcePhoneNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      to {log.requestedPhoneNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                    {(log.responseMessage || log.errorMessage) && (
                      <div className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                        {log.responseMessage || log.errorMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{log.actorName || log.actorUserId}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update USSD client information</DialogTitle>
            <DialogDescription>
              Search for the current USSD phone number, then enter the new phone
              number to update USSD and Loan Matrix together.
            </DialogDescription>
          </DialogHeader>

          {modalNotice && (
            <Alert
              variant={
                modalNotice.type === "error" ? "destructive" : "default"
              }
            >
              {modalNotice.type === "error" ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>{modalNotice.title}</AlertTitle>
              <AlertDescription>{modalNotice.message}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-3" onSubmit={handleSearch}>
            <Label>Current USSD phone number</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={sourceCountryCode}
                onValueChange={setSourceCountryCode}
                disabled={isSearching || isSaving}
              >
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AFRICAN_COUNTRY_CODES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={sourcePhoneNumber}
                onChange={(event) => setSourcePhoneNumber(event.target.value)}
                placeholder="977123456"
                inputMode="tel"
                disabled={isSearching || isSaving}
              />
              <Button
                type="submit"
                disabled={isSearching || isSaving || !sourcePhoneNumber.trim()}
              >
                {isSearching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </form>

          {user && (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-semibold">{user.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client ID</p>
                <p className="font-medium">{user.externalId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current USSD phone</p>
                <p className="font-medium">{user.phoneNumber}</p>
              </div>

              <div className="space-y-2">
                <Label>New phone number</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={newCountryCode}
                    onValueChange={setNewCountryCode}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AFRICAN_COUNTRY_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newPhoneNumber}
                    onChange={(event) => setNewPhoneNumber(event.target.value)}
                    placeholder="966654321"
                    inputMode="tel"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={isSaving}
            >
              {modalNotice?.type === "success" ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !user || !newPhoneNumber.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
