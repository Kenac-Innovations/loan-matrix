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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info } from "lucide-react";

interface ReopenDialogProps {
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReopenDialog({
  eventId,
  onClose,
  onSuccess,
}: ReopenDialogProps) {
  const [notes, setNotes] = useState("");
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReopen = async () => {
    if (!notes.trim()) {
      setError("Please provide notes explaining why the event is being reopened");
      return;
    }

    setReopening(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/variance-events/${eventId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reopen",
            notes: notes.trim(),
          }),
        }
      );

      if (response.ok) {
        onClose();
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to reopen event");
      }
    } catch (err) {
      console.error("Error reopening event:", err);
      setError("Failed to reopen event");
    } finally {
      setReopening(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reopen Variance Event</DialogTitle>
          <DialogDescription>
            Reopen this resolved variance event to make further adjustments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Reopening this event will reverse any vault adjustments made from the resolution.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Reason for Reopening <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this resolved event is being reopened (e.g., 'Additional cash found', 'Correction needed', etc.)"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Provide a clear explanation for reopening this event
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
            disabled={reopening}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReopen}
            disabled={reopening || !notes.trim()}
          >
            {reopening ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reopening...
              </>
            ) : (
              "Reopen Event"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
