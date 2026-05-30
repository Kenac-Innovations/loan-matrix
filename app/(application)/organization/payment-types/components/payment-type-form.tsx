"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { PaymentType, PaymentTypePayload } from "@/shared/types/payment-type";

interface PaymentTypeFormProps {
  mode: "create" | "edit";
  initialData?: PaymentType | null;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

type FormState = {
  name: string;
  description: string;
  isCashPayment: boolean;
  position: string;
};

function buildInitialState(initialData?: PaymentType | null): FormState {
  return {
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    isCashPayment: initialData?.isCashPayment ?? false,
    position:
      initialData?.position != null ? String(initialData.position) : "",
  };
}

export default function PaymentTypeForm({
  mode,
  initialData,
  onCancel,
  onSuccess,
}: PaymentTypeFormProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(buildInitialState(initialData));
  }, [initialData, mode]);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const validate = () => {
    if (!form.name.trim()) {
      toast({
        title: "Validation error",
        description: "Name is required.",
        variant: "destructive",
      });
      return false;
    }

    if (!form.position.trim()) {
      toast({
        title: "Validation error",
        description: "Position is required.",
        variant: "destructive",
      });
      return false;
    }

    const parsedPosition = Number(form.position);
    if (!Number.isFinite(parsedPosition)) {
      toast({
        title: "Validation error",
        description: "Position must be a valid number.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: PaymentTypePayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      isCashPayment: form.isCashPayment,
      position: Number(form.position),
    };

    setIsSubmitting(true);
    try {
      const endpoint =
        mode === "create"
          ? "/api/fineract/paymenttypes"
          : `/api/fineract/paymenttypes/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || `Failed to ${mode} payment type`);
      }

      toast({
        title:
          mode === "create"
            ? "Payment type created"
            : "Payment type updated",
        description: payload.name,
        variant: "success",
      });

      await onSuccess();
    } catch (error) {
      toast({
        title: `Unable to ${mode} payment type`,
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="payment-type-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="payment-type-name"
          value={form.name}
          onChange={(event) => handleChange("name", event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment-type-description">Description</Label>
        <Textarea
          id="payment-type-description"
          value={form.description}
          onChange={(event) =>
            handleChange("description", event.target.value)
          }
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="payment-type-cash">Is Cash Payment</Label>
          <p className="text-sm text-muted-foreground">
            Toggle this on when the payment type represents a cash payment.
          </p>
        </div>
        <Switch
          id="payment-type-cash"
          checked={form.isCashPayment}
          onCheckedChange={(checked) =>
            handleChange("isCashPayment", checked)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment-type-position">
          Position <span className="text-destructive">*</span>
        </Label>
        <Input
          id="payment-type-position"
          type="number"
          inputMode="numeric"
          value={form.position}
          onChange={(event) =>
            handleChange("position", event.target.value)
          }
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Submit
        </Button>
      </div>
    </form>
  );
}
