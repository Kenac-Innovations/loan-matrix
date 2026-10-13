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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info } from "lucide-react";

interface ResolveVarianceDialogProps {
  eventId: string;
  eventType: "SHORTAGE" | "OVERAGE";
  onClose: () => void;
  onSuccess: () => void;
}

type ResolutionType =
  | "CASHIER_REPAID"
  | "RETURNED_TO_CLIENT"
  | "COUNTING_ERROR"
  | "WRITTEN_OFF"
  | "SALARY_RECOVERY"
  | "POSTED_TO_SUSPENSE";

const RESOLUTION_TYPES: {
  value: ResolutionType;
  label: string;
  shortageOnly?: boolean;
  overageOnly?: boolean;
  hint?: string;
}[] = [
  {
    value: "CASHIER_REPAID",
    label: "Cashier repaid",
    shortageOnly: true,
    hint: "Adds the repaid cash to the teller vault",
  },
  {
    value: "RETURNED_TO_CLIENT",
    label: "Returned to client",
    overageOnly: true,
    hint: "Removes the cash from the teller vault",
  },
  { value: "COUNTING_ERROR", label: "Counting error" },
  { value: "WRITTEN_OFF", label: "Written off" },
  { value: "SALARY_RECOVERY", label: "Recovered from salary" },
  { value: "POSTED_TO_SUSPENSE", label: "Posted to suspense" },
];

export function ResolveVarianceDialog({
  eventId,
  eventType,
  onClose,
  onSuccess,
}: ResolveVarianceDialogProps) {
  const [resolutionType, setResolutionType] = useState<ResolutionType | "">("");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTypes = RESOLUTION_TYPES.filter((type) => {
    if (eventType === "SHORTAGE" && type.overageOnly) return false;
    if (eventType === "OVERAGE" && type.shortageOnly) return false;
    return true;
  });

  const selectedTypeInfo = RESOLUTION_TYPES.find(
    (t) => t.value === resolutionType
  );

  const handleResolve = async () => {
    if (!resolutionType || !notes.trim()) {
      setError("Please select a resolution type and provide notes");
      return;
    }

    setResolving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/variance-events/${eventId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "resolve",
            resolutionType,
            notes: notes.trim(),
          }),
        }
      );

      if (response.ok) {
        onClose();
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to resolve variance");
      }
    } catch (err) {
      console.error("Error resolving variance:", err);
      setError("Failed to resolve variance");
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Resolve Variance</DialogTitle>
          <DialogDescription>
            Select a resolution type and provide notes explaining the action taken.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="resolutionType">
              Resolution Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={resolutionType}
              onValueChange={(value) => setResolutionType(value as ResolutionType)}
            >
              <SelectTrigger id="resolutionType">
                <SelectValue placeholder="Select resolution type" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTypeInfo?.hint && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {selectedTypeInfo.hint}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the resolution action (e.g., 'Cashier counted their drawer and found the missing amount', 'Overage was returned to client', etc.)"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Provide a clear explanation of the resolution
            </p>
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
            variant="outline"
            onClick={onClose}
            disabled={resolving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={resolving || !resolutionType || !notes.trim()}
          >
            {resolving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resolving...
              </>
            ) : (
              "Resolve Variance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
