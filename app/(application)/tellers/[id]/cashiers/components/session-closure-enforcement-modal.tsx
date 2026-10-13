"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

interface SessionClosureEnforcementInfo {
  mode: "ENFORCE" | "EXEMPT" | "INHERIT";
  enforced: boolean;
  source?: "CASHIER" | "TENANT_DEFAULT";
  reason?: "MODULE_OFF" | "CASHIER_EXEMPT" | "NOT_ENROLLED";
  enforcedFrom?: Date;
}

interface SessionClosureEnforcementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashier: {
    id: string | number;
    dbId?: string | null;
    staffName: string;
    sessionClosureEnforcement?: SessionClosureEnforcementInfo | null;
  };
  onSuccess?: () => void;
}

type EnforcementMode = "ENFORCE" | "EXEMPT" | "INHERIT";

export function SessionClosureEnforcementModal({
  open,
  onOpenChange,
  tellerId,
  cashier,
  onSuccess,
}: SessionClosureEnforcementModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EnforcementMode>(
    cashier.sessionClosureEnforcement?.mode || "INHERIT"
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const cashierId = cashier.dbId || String(cashier.id);
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session-closure-enforcement`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          throw new Error("Only super admins can change this setting.");
        }
        throw new Error(data.error || "Failed to update setting");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  const enforcement = cashier.sessionClosureEnforcement;

  const getEnforcementDescription = (): string => {
    if (!enforcement) return "";

    if (enforcement.enforced) {
      const source =
        enforcement.source === "CASHIER" ? "cashier setting" : "tenant default";
      const fromDate = enforcement.enforcedFrom
        ? new Date(enforcement.enforcedFrom).toLocaleDateString()
        : "";
      return `Enforced since ${fromDate} (${source})`;
    }

    const reasons: Record<string, string> = {
      MODULE_OFF: "Not enforced (module off)",
      CASHIER_EXEMPT: "Not enforced (exempt)",
      NOT_ENROLLED: "Not enforced (not enrolled)",
    };

    return reasons[enforcement.reason || ""] || "Not enforced";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Session Closure Enforcement</DialogTitle>
          <DialogDescription>
            Set enforcement mode for {cashier.staffName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Current state</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getEnforcementDescription()}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Set to</Label>
            <RadioGroup value={mode} onValueChange={(val) => setMode(val as EnforcementMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="INHERIT" id="inherit" />
                <Label htmlFor="inherit" className="cursor-pointer text-sm font-normal">
                  Use tenant default
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ENFORCE" id="enforce" />
                <Label htmlFor="enforce" className="cursor-pointer text-sm font-normal">
                  Enforce
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="EXEMPT" id="exempt" />
                <Label htmlFor="exempt" className="cursor-pointer text-sm font-normal">
                  Exempt
                </Label>
              </div>
            </RadioGroup>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || mode === enforcement?.mode}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
