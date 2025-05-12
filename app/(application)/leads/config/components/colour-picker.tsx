"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

interface ColourPickerProps {
  colour: string;
  onChange: (colour: string) => void;
}

const predefinedColours = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate
  "#6b7280", // gray
  "#000000", // black
];

export function ColourPicker({ colour, onChange }: ColourPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-[#2a304d] bg-[#0d121f] text-white hover:bg-[#1a2035] hover:text-white"
        >
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: colour }}
          />
          <span>{colour}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-[#0d121f] border-[#2a304d] p-3">
        <div className="grid grid-cols-5 gap-2">
          {predefinedColours.map((c) => (
            <button
              key={c}
              className="h-8 w-8 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0d121f] focus:ring-white"
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              {colour === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
