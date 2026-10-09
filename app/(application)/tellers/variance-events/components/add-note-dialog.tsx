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
import { Loader2, AlertCircle } from "lucide-react";

interface AddNoteDialogProps {
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddNoteDialog({
  eventId,
  onClose,
  onSuccess,
}: AddNoteDialogProps) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveNote = async () => {
    if (!notes.trim()) {
      setError("Please enter a note");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tellers/variance-events/${eventId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-note",
            notes: notes.trim(),
          }),
        }
      );

      if (response.ok) {
        onClose();
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to add note");
      }
    } catch (err) {
      console.error("Error adding note:", err);
      setError("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Add a note to this variance event for tracking and documentation purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">
              Note <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your note here..."
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Your note will be added to the event&apos;s history
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
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveNote}
            disabled={saving || !notes.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add Note"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
