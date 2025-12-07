"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface StartSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tellerId: string;
  cashierId: string;
  cashierName?: string;
  allocatedBalance?: number;
}

export function StartSessionModal({
  open,
  onOpenChange,
  tellerId,
  cashierId,
  cashierName,
  allocatedBalance = 0,
}: StartSessionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/${tellerId}/cashiers/${cashierId}/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        }
      );

      if (response.ok || response.status === 207) {
        const result = await response.json();
        if (result.warning) {
          alert(`Session started but with warning: ${result.warning}`);
        }
        onOpenChange(false);
        router.refresh();
      } else {
        let errorMessage = "Failed to start session";
        try {
          const errorData = await response.json();
          console.error("Start session error response:", {
            status: response.status,
            statusText: response.statusText,
            errorData,
          });

          // Handle empty object or missing error fields
          if (errorData && Object.keys(errorData).length > 0) {
            errorMessage =
              errorData.error ||
              errorData.details ||
              errorData.message ||
              JSON.stringify(errorData);
          } else {
            errorMessage = `Server error: ${response.status} ${
              response.statusText || "Unknown error"
            }`;
          }
        } catch (parseError) {
          // Response is not JSON
          const text = await response.text();
          errorMessage =
            text ||
            `Server error: ${response.status} ${
              response.statusText || "Unknown error"
            }`;
          console.error("Start session error (non-JSON):", {
            status: response.status,
            statusText: response.statusText,
            text,
          });
        }
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Error starting session:", error);
      setError("Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Cashier Session</DialogTitle>
          <DialogDescription>
            {cashierName && `Start a new session for ${cashierName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {allocatedBalance > 0 ? (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Opening Float:</p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(allocatedBalance)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This is the allocated cash balance for this session.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                No cash has been allocated to this cashier. Please allocate cash
                before starting a session.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
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
            onClick={handleStart}
            disabled={loading || allocatedBalance === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Session"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
