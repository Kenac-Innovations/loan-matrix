"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageSquarePlus,
  StickyNote,
  ArrowRightLeft,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Note {
  id: number;
  noteType: { id: number; code: string; value: string };
  note: string;
  createdByUsername: string;
  createdOn: number;
  updatedByUsername?: string;
  updatedOn?: number;
}

interface LeadNotesProps {
  leadId: string;
  fineractLoanId?: number | null;
}

export function LeadNotes({ leadId, fineractLoanId }: LeadNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [transitionNotes, setTransitionNotes] = useState<
    { id: string; fromStage: string; toStage: string; reason: string; triggeredBy: string; triggeredAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];

      // Fetch Fineract loan notes
      if (fineractLoanId) {
        promises.push(
          fetch(`/api/fineract/loans/${fineractLoanId}/notes`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Fetch transition notes from state transitions
      promises.push(
        fetch(`/api/leads/${leadId}/transition`)
          .then(async (r) => {
            if (!r.ok) return [];
            const data = await r.json();
            return data.transitions || [];
          })
          .catch(() => [])
      );

      // Fetch state transition history for notes
      promises.push(
        fetch(`/api/leads/${leadId}/transitions-history`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      );

      const [fineractNotes, , transitionHistory] = await Promise.all(promises);

      const fNotes = Array.isArray(fineractNotes) ? fineractNotes : [];
      setNotes(fNotes);

      // Extract notes from transition metadata
      const tNotes = (Array.isArray(transitionHistory) ? transitionHistory : [])
        .filter((t: any) => t.metadata?.reason)
        .map((t: any) => ({
          id: t.id,
          fromStage: t.fromStage?.name || "Unknown",
          toStage: t.toStage?.name || "Unknown",
          reason: t.metadata.reason,
          triggeredBy: t.triggeredBy || "System",
          triggeredAt: t.triggeredAt || t.createdAt,
        }));
      setTransitionNotes(tNotes);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, fineractLoanId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !fineractLoanId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/fineract/loans/${fineractLoanId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote.trim() }),
      });

      if (res.ok) {
        toast({ title: "Note Added", description: "Note has been posted to the loan." });
        setNewNote("");
        fetchNotes();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: err.error || "Failed to add note",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === "number"
      ? new Date(timestamp)
      : new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Combine and sort all notes by date
  const allNotes: {
    type: "fineract" | "transition";
    date: Date;
    content: string;
    author: string;
    fromStage?: string;
    toStage?: string;
    id: string | number;
  }[] = [
    ...notes.map((n) => ({
      type: "fineract" as const,
      date: new Date(n.createdOn),
      content: n.note,
      author: n.createdByUsername || "Unknown",
      id: n.id,
    })),
    ...transitionNotes.map((t) => ({
      type: "transition" as const,
      date: new Date(t.triggeredAt),
      content: t.reason,
      author: t.triggeredBy,
      fromStage: t.fromStage,
      toStage: t.toStage,
      id: t.id,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Notes
        </CardTitle>
        <CardDescription>
          Loan notes and stage transition comments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note */}
        {fineractLoanId && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAddNote}
              disabled={submitting || !newNote.trim()}
              size="sm"
              className="self-end"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* Notes List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : allNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquarePlus className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No notes yet.</p>
            {fineractLoanId && (
              <p className="text-xs mt-1">Add a note above to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {allNotes.map((note) => (
              <div
                key={`${note.type}-${note.id}`}
                className={`rounded-lg border p-3 ${
                  note.type === "transition"
                    ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900"
                    : "bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {note.type === "transition" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-300 text-blue-700 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400"
                      >
                        <ArrowRightLeft className="h-2.5 w-2.5 mr-0.5" />
                        Transition
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        <StickyNote className="h-2.5 w-2.5 mr-0.5" />
                        Note
                      </Badge>
                    )}
                    {note.type === "transition" && note.fromStage && (
                      <span className="text-[10px] text-muted-foreground">
                        {note.fromStage} → {note.toStage}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDate(note.date.getTime())}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  by {note.author}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
