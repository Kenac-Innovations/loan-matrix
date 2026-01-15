"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function BackButton({ 
  className, 
  variant = "outline", 
  size = "sm" 
}: BackButtonProps) {
  const router = useRouter();

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}

