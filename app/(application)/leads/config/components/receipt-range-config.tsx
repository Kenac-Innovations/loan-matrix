"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Receipt } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface ReceiptRange {
  id: string;
  prefix: string | null;
  rangeStart: number;
  rangeEnd: number;
  isActive: boolean;
  totalInRange: number;
  usedCount: number;
  createdAt: string;
}

export function ReceiptRangeConfig() {
  const [ranges, setRanges] = useState<ReceiptRange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const fetchRanges = useCallback(async () => {
    try {
      const res = await fetch("/api/receipt-ranges");
      if (res.ok) {
        const data = await res.json();
        setRanges(data.ranges);
      }
    } catch (err) {
      console.error("Failed to fetch receipt ranges:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRanges();
  }, [fetchRanges]);

  const handleCreate = async () => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);

    if (isNaN(start) || isNaN(end)) {
      toast({ title: "Error", description: "Start and end must be numbers", variant: "destructive" });
      return;
    }

    if (start >= end) {
      toast({ title: "Error", description: "Start must be less than end", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/receipt-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: prefix.trim() || null,
          rangeStart: start,
          rangeEnd: end,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      toast({ title: "Success", description: "Receipt range created" });
      setIsDialogOpen(false);
      setPrefix("");
      setRangeStart("");
      setRangeEnd("");
      fetchRanges();
    } catch (err) {
      toast({ title: "Error", description: "Failed to create range", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Define receipt number ranges. Cash transactions (repayments and disbursements) will
            require a receipt number within an active range.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Range
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Receipt Range</DialogTitle>
              <DialogDescription>
                Define a new range of receipt numbers. Numbers must not overlap with existing active ranges.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Prefix (optional)</Label>
                <Input
                  placeholder="e.g. RCT-"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If set, users must enter the prefix before the number (e.g. RCT-0001)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Range Start</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Range End</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                  />
                </div>
              </div>
              {rangeStart && rangeEnd && parseInt(rangeEnd) > parseInt(rangeStart) && (
                <p className="text-sm text-muted-foreground">
                  This will allow {(parseInt(rangeEnd) - parseInt(rangeStart) + 1).toLocaleString()} receipt numbers
                  ({prefix || ""}{rangeStart} to {prefix || ""}{rangeEnd})
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Range"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : ranges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No receipt ranges configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a receipt number range to start tracking receipt numbers on cash transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefix</TableHead>
              <TableHead>Range</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranges.map((range) => (
              <TableRow key={range.id}>
                <TableCell className="font-mono">{range.prefix || "—"}</TableCell>
                <TableCell className="font-mono">
                  {range.rangeStart.toLocaleString()} – {range.rangeEnd.toLocaleString()}
                </TableCell>
                <TableCell>{range.totalInRange.toLocaleString()}</TableCell>
                <TableCell>{range.usedCount.toLocaleString()}</TableCell>
                <TableCell>{(range.totalInRange - range.usedCount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={range.isActive ? "default" : "secondary"}>
                    {range.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
