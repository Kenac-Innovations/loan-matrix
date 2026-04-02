"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CodeOpt = { id: number; name: string };

type StakeholderRow = {
  id?: string;
  role: "DIRECTOR" | "SHAREHOLDER";
  fullName: string;
  nationalIdOrPassport: string;
  residentialAddress: string;
  proofOfResidenceLeadDocumentId: string;
  fineractDocumentId: string;
  pepStatusCodeValueId: string;
  pepStatusLabel: string;
  shareholdingPercentage: string;
  isUltimateBeneficialOwner: boolean;
  controlStructureCodeValueId: string;
  controlStructureLabel: string;
  sortOrder: number;
};

type BankRow = {
  id?: string;
  bankName: string;
  accountNumber: string;
  accountSignatories: string;
  sortOrder: number;
};

function mapStakeholderToRow(s: any): StakeholderRow {
  return {
    id: s.id,
    role: s.role,
    fullName: s.fullName ?? "",
    nationalIdOrPassport: s.nationalIdOrPassport ?? "",
    residentialAddress: s.residentialAddress ?? "",
    proofOfResidenceLeadDocumentId: s.proofOfResidenceLeadDocumentId ?? "",
    fineractDocumentId:
      s.fineractDocumentId != null ? String(s.fineractDocumentId) : "",
    pepStatusCodeValueId:
      s.pepStatusCodeValueId != null ? String(s.pepStatusCodeValueId) : "",
    pepStatusLabel: s.pepStatusLabel ?? "",
    shareholdingPercentage:
      s.shareholdingPercentage != null ? String(s.shareholdingPercentage) : "",
    isUltimateBeneficialOwner: Boolean(s.isUltimateBeneficialOwner),
    controlStructureCodeValueId:
      s.controlStructureCodeValueId != null
        ? String(s.controlStructureCodeValueId)
        : "",
    controlStructureLabel: s.controlStructureLabel ?? "",
    sortOrder: s.sortOrder ?? 0,
  };
}

function mapBankToRow(b: any): BankRow {
  return {
    id: b.id,
    bankName: b.bankName ?? "",
    accountNumber: b.accountNumber ?? "",
    accountSignatories: b.accountSignatories ?? "",
    sortOrder: b.sortOrder ?? 0,
  };
}

function emptyDirector(sort: number): StakeholderRow {
  return {
    role: "DIRECTOR",
    fullName: "",
    nationalIdOrPassport: "",
    residentialAddress: "",
    proofOfResidenceLeadDocumentId: "",
    fineractDocumentId: "",
    pepStatusCodeValueId: "",
    pepStatusLabel: "",
    shareholdingPercentage: "",
    isUltimateBeneficialOwner: false,
    controlStructureCodeValueId: "",
    controlStructureLabel: "",
    sortOrder: sort,
  };
}

function emptyShareholder(sort: number): StakeholderRow {
  return {
    role: "SHAREHOLDER",
    fullName: "",
    nationalIdOrPassport: "",
    residentialAddress: "",
    proofOfResidenceLeadDocumentId: "",
    fineractDocumentId: "",
    pepStatusCodeValueId: "",
    pepStatusLabel: "",
    shareholdingPercentage: "",
    isUltimateBeneficialOwner: false,
    controlStructureCodeValueId: "",
    controlStructureLabel: "",
    sortOrder: sort,
  };
}

function emptyBank(sort: number): BankRow {
  return {
    bankName: "",
    accountNumber: "",
    accountSignatories: "",
    sortOrder: sort,
  };
}

function getDirectorFormError(
  draft: StakeholderRow,
  pendingProofFile: File | null,
  fineractClientId: number | null | undefined
): string | null {
  if (!draft.fullName.trim()) return "Full name is required.";
  if (!draft.nationalIdOrPassport.trim()) {
    return "National ID or passport is required.";
  }
  if (!draft.residentialAddress.trim()) {
    return "Residential address is required.";
  }
  const hasStoredProof = Boolean(draft.fineractDocumentId?.trim());
  const hasPendingProof = Boolean(pendingProofFile);
  if (!hasStoredProof && !hasPendingProof) {
    return "Proof of residence is required.";
  }
  if (hasPendingProof && !fineractClientId) {
    return "A Fineract client ID is required to upload proof of residence.";
  }
  if (!draft.pepStatusCodeValueId?.trim()) {
    return "PEP status is required.";
  }
  return null;
}

function sanitizeDocNamePart(value: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "STAKEHOLDER";
}

function buildProofOfResidenceDocumentName(fullName: string): string {
  return `${sanitizeDocNamePart(fullName)}_PROOF_OF_RESIDENCE`;
}

function extractFineractDocumentId(payload: any): string | null {
  const id =
    payload?.resourceId ??
    payload?.documentId ??
    payload?.id ??
    payload?.resourceIdentifier;
  if (id == null) return null;
  return String(id);
}

async function postOperation(body: Record<string, unknown>) {
  const res = await fetch("/api/leads/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || res.statusText || "Request failed");
  }
  return json;
}

export function EntityStructureEditor({
  leadId,
  fineractClientId,
  initialStakeholders,
  initialBankAccounts,
  onRefresh,
}: {
  leadId: string | null;
  fineractClientId?: number | null;
  initialStakeholders: any[];
  initialBankAccounts: any[];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [pepOptions, setPepOptions] = useState<CodeOpt[]>([]);
  const [controlOptions, setControlOptions] = useState<CodeOpt[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingBanks, setSavingBanks] = useState(false);
  const [stakeholderModal, setStakeholderModal] = useState<null | {
    kind: "dir" | "sh";
    draft: StakeholderRow;
    pendingProofFile: File | null;
  }>(null);
  const [bankModal, setBankModal] = useState<null | {
    draft: BankRow;
    index: number | null;
  }>(null);

  const [directors, setDirectors] = useState<StakeholderRow[]>([]);
  const [shareholders, setShareholders] = useState<StakeholderRow[]>([]);
  const [banks, setBanks] = useState<BankRow[]>([]);

  const loadCodes = useCallback(async () => {
    try {
      const [pepRes, ctrlRes] = await Promise.all([
        fetch("/api/fineract/codes/PEP_STATUS/codevalues"),
        fetch("/api/fineract/codes/CONTROL_STRUCTURE_DECLARATION/codevalues"),
      ]);
      if (pepRes.ok) {
        const d = await pepRes.json();
        const arr = Array.isArray(d) ? d : d.data || [];
        setPepOptions(
          arr.map((x: any) => ({ id: x.id, name: x.name || String(x.id) }))
        );
      }
      if (ctrlRes.ok) {
        const d = await ctrlRes.json();
        const arr = Array.isArray(d) ? d : d.data || [];
        setControlOptions(
          arr.map((x: any) => ({ id: x.id, name: x.name || String(x.id) }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    const dirs = initialStakeholders
      .filter((s) => s.role === "DIRECTOR")
      .map(mapStakeholderToRow);
    const sh = initialStakeholders
      .filter((s) => s.role === "SHAREHOLDER")
      .map(mapStakeholderToRow);
    setDirectors(dirs.length ? dirs : []);
    setShareholders(sh.length ? sh : []);
    setBanks(
      initialBankAccounts.length
        ? initialBankAccounts.map(mapBankToRow)
        : []
    );
  }, [initialStakeholders, initialBankAccounts]);

  const uploadProofToFineract = useCallback(
    async (row: StakeholderRow, file: File): Promise<string> => {
      if (!fineractClientId) {
        throw new Error("Fineract client ID is required to upload proof of residence.");
      }

      const formData = new FormData();
      formData.append("name", buildProofOfResidenceDocumentName(row.fullName));
      formData.append("description", "Proof of residence");
      formData.append("file", file);

      const res = await fetch(`/api/fineract/clients/${fineractClientId}/documents`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string" ? json.error : "Failed to upload document to Fineract"
        );
      }
      const documentId = extractFineractDocumentId(json);
      if (!documentId) {
        throw new Error("Fineract document upload succeeded but no document ID was returned.");
      }
      return documentId;
    },
    [fineractClientId]
  );

  const saveStakeholder = async (
    row: StakeholderRow,
    list: "dir" | "sh",
    pendingProofFile: File | null
  ): Promise<boolean> => {
    if (!leadId && !fineractClientId) {
      toast({
        variant: "destructive",
        title: "Cannot save",
        description: "Save the lead first or ensure client is linked.",
      });
      return false;
    }
    const key = row.id || `new-${list}-${row.sortOrder}`;
    setSavingId(key);
    try {
      const pepId = row.pepStatusCodeValueId
        ? Number(row.pepStatusCodeValueId)
        : null;
      const pepLabel =
        pepOptions.find((o) => o.id === pepId)?.name || row.pepStatusLabel || null;

      let ctrlId: number | null = null;
      let ctrlLabel: string | null = null;
      if (row.role === "SHAREHOLDER" && row.isUltimateBeneficialOwner) {
        ctrlId = row.controlStructureCodeValueId
          ? Number(row.controlStructureCodeValueId)
          : null;
        ctrlLabel =
          controlOptions.find((o) => o.id === ctrlId)?.name ||
          row.controlStructureLabel ||
          null;
      }

      let fineractDocumentId = row.fineractDocumentId?.trim() || null;
      if (pendingProofFile) {
        fineractDocumentId = await uploadProofToFineract(row, pendingProofFile);
      }

      await postOperation({
        operation: "upsertEntityStakeholder",
        ...(leadId ? { leadId } : {}),
        data: {
          ...(fineractClientId ? { fineractClientId } : {}),
          ...(row.id ? { id: row.id } : {}),
          role: row.role,
          fullName: row.fullName,
          nationalIdOrPassport: row.nationalIdOrPassport,
          residentialAddress: row.residentialAddress,
          fineractDocumentId,
          proofOfResidenceLeadDocumentId:
            row.proofOfResidenceLeadDocumentId || null,
          pepStatusCodeValueId: pepId,
          pepStatusLabel: pepLabel,
          shareholdingPercentage:
            row.role === "SHAREHOLDER" && row.shareholdingPercentage !== ""
              ? Number(row.shareholdingPercentage)
              : null,
          isUltimateBeneficialOwner:
            row.role === "SHAREHOLDER" ? row.isUltimateBeneficialOwner : false,
          controlStructureCodeValueId: ctrlId,
          controlStructureLabel: ctrlLabel,
          sortOrder: row.sortOrder,
        },
      });
      toast({ title: "Saved", description: "Stakeholder saved." });
      await onRefresh();
      return true;
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to save",
      });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const removeStakeholder = async (row: StakeholderRow) => {
    if (!row.id) {
      if (row.role === "DIRECTOR") {
        setDirectors((d) => d.filter((x) => x !== row));
      } else {
        setShareholders((d) => d.filter((x) => x !== row));
      }
      return;
    }
    try {
      await postOperation({
        operation: "removeEntityStakeholder",
        ...(leadId ? { leadId } : {}),
        data: { id: row.id, ...(fineractClientId ? { fineractClientId } : {}) },
      });
      toast({ title: "Removed" });
      await onRefresh();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    }
  };

  const persistBankAccounts = async (next: BankRow[]): Promise<boolean> => {
    if (!leadId && !fineractClientId) return false;
    setSavingBanks(true);
    try {
      await postOperation({
        operation: "replaceEntityBankAccounts",
        ...(leadId ? { leadId } : {}),
        data: {
          ...(fineractClientId ? { fineractClientId } : {}),
          accounts: next.map((b, idx) => ({
            bankName: b.bankName,
            accountNumber: b.accountNumber,
            accountSignatories: b.accountSignatories,
            sortOrder: idx,
          })),
        },
      });
      toast({ title: "Saved", description: "Banking details updated." });
      await onRefresh();
      return true;
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
      return false;
    } finally {
      setSavingBanks(false);
    }
  };

  const removeBankAt = async (index: number) => {
    const next = banks
      .filter((_, i) => i !== index)
      .map((b, i) => ({ ...b, sortOrder: i }));
    await persistBankAccounts(next);
  };

  const patchStakeholderDraft = (
    updater: (d: StakeholderRow) => StakeholderRow
  ) => {
    setStakeholderModal((m) => (m ? { ...m, draft: updater(m.draft) } : m));
  };

  if (!leadId && !fineractClientId) {
    return (
      <p className="text-sm text-muted-foreground">
        Save the lead to manage directors, shareholders, and entity banking.
      </p>
    );
  }

  const stakeholderSaveKey = stakeholderModal
    ? stakeholderModal.draft.id ||
      `new-${stakeholderModal.kind}-${stakeholderModal.draft.sortOrder}`
    : null;

  return (
    <div className="space-y-8">
      <Dialog
        open={stakeholderModal !== null}
        onOpenChange={(open) => {
          if (!open) setStakeholderModal(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          {stakeholderModal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {stakeholderModal.kind === "dir"
                    ? stakeholderModal.draft.id
                      ? "Edit director"
                      : "Add director"
                    : stakeholderModal.draft.id
                      ? "Edit shareholder"
                      : "Add shareholder"}
                </DialogTitle>
                <DialogDescription>
                  Complete the details below, then save to add this record to the
                  list.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="flex flex-col gap-2">
                  <div className="space-y-1 w-full">
                    <Label>
                      Full name
                      {stakeholderModal.kind === "dir" && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <Input
                      className="w-full"
                      value={stakeholderModal.draft.fullName}
                      onChange={(e) =>
                        patchStakeholderDraft((d) => ({
                          ...d,
                          fullName: e.target.value,
                        }))
                      }
                      required={stakeholderModal.kind === "dir"}
                    />
                  </div>
                  <div className="space-y-1 w-full">
                    <Label>
                      National ID / Passport
                      {stakeholderModal.kind === "dir" && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <Input
                      className="w-full"
                      value={stakeholderModal.draft.nationalIdOrPassport}
                      onChange={(e) =>
                        patchStakeholderDraft((d) => ({
                          ...d,
                          nationalIdOrPassport: e.target.value,
                        }))
                      }
                      required={stakeholderModal.kind === "dir"}
                    />
                  </div>
                </div>
                <div className="space-y-1 w-full">
                  <Label>
                    Residential address
                    {stakeholderModal.kind === "dir" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Textarea
                    className="w-full"
                    value={stakeholderModal.draft.residentialAddress}
                    onChange={(e) =>
                      patchStakeholderDraft((d) => ({
                        ...d,
                        residentialAddress: e.target.value,
                      }))
                    }
                    rows={2}
                    required={stakeholderModal.kind === "dir"}
                  />
                </div>
                {stakeholderModal.kind === "sh" && (
                  <div className="space-y-1 w-full">
                    <Label>Shareholding %</Label>
                    <Input
                      className="w-full"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={stakeholderModal.draft.shareholdingPercentage}
                      onChange={(e) =>
                        patchStakeholderDraft((d) => ({
                          ...d,
                          shareholdingPercentage: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="space-y-2 w-full">
                  <Label>
                    Proof of residence
                    {stakeholderModal.kind === "dir" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = "";
                      setStakeholderModal((m) =>
                        m ? { ...m, pendingProofFile: f } : m
                      );
                    }}
                  />
                  {stakeholderModal.pendingProofFile && (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        Selected file: {stakeholderModal.pendingProofFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() =>
                          setStakeholderModal((m) =>
                            m ? { ...m, pendingProofFile: null } : m
                          )
                        }
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  {stakeholderModal.draft.fineractDocumentId && (
                    <div className="text-xs text-muted-foreground">
                      Existing Fineract document ID: {stakeholderModal.draft.fineractDocumentId}
                    </div>
                  )}
                  {!fineractClientId && stakeholderModal.pendingProofFile && (
                    <div className="text-xs text-destructive">
                      This lead is not linked to a Fineract client yet, so document upload will fail.
                    </div>
                  )}
                </div>
                <div className="space-y-1 w-full">
                  <Label>
                    PEP status
                    {stakeholderModal.kind === "dir" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Select
                    value={
                      stakeholderModal.draft.pepStatusCodeValueId
                        ? stakeholderModal.draft.pepStatusCodeValueId
                        : stakeholderModal.kind === "dir"
                          ? "__pick_pep__"
                          : "__none__"
                    }
                    onValueChange={(v) => {
                      if (v === "__pick_pep__") return;
                      const id = v === "__none__" ? "" : v;
                      const label =
                        pepOptions.find((o) => String(o.id) === id)?.name || "";
                      patchStakeholderDraft((d) => ({
                        ...d,
                        pepStatusCodeValueId: id,
                        pepStatusLabel: label,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select PEP status" />
                    </SelectTrigger>
                    <SelectContent>
                      {stakeholderModal.kind === "dir" && (
                        <SelectItem value="__pick_pep__" disabled>
                          Select PEP status
                        </SelectItem>
                      )}
                      {stakeholderModal.kind === "sh" && (
                        <SelectItem value="__none__">None</SelectItem>
                      )}
                      {pepOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {stakeholderModal.kind === "sh" && (
                  <>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stakeholderModal.draft.isUltimateBeneficialOwner}
                        onChange={(e) =>
                          patchStakeholderDraft((d) => ({
                            ...d,
                            isUltimateBeneficialOwner: e.target.checked,
                          }))
                        }
                        className="rounded border-input"
                      />
                      Ultimate beneficial owner
                    </label>
                    {stakeholderModal.draft.isUltimateBeneficialOwner && (
                      <div className="space-y-1 w-full">
                        <Label>Control structure declaration</Label>
                        <Select
                          value={
                            stakeholderModal.draft.controlStructureCodeValueId ||
                            "__none__"
                          }
                          onValueChange={(v) => {
                            const id = v === "__none__" ? "" : v;
                            const label =
                              controlOptions.find((o) => String(o.id) === id)
                                ?.name || "";
                            patchStakeholderDraft((d) => ({
                              ...d,
                              controlStructureCodeValueId: id,
                              controlStructureLabel: label,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Nature of control" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {controlOptions.map((o) => (
                              <SelectItem key={o.id} value={String(o.id)}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStakeholderModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    (!!stakeholderSaveKey && savingId === stakeholderSaveKey) ||
                    (!leadId && !fineractClientId)
                  }
                  onClick={async () => {
                    const m = stakeholderModal;
                    if (!m) return;
                    if (m.kind === "dir") {
                      const err = getDirectorFormError(
                        m.draft,
                        m.pendingProofFile,
                        fineractClientId
                      );
                      if (err) {
                        toast({
                          variant: "destructive",
                          title: "Required fields",
                          description: err,
                        });
                        return;
                      }
                    }
                    const ok = await saveStakeholder(
                      m.draft,
                      m.kind === "dir" ? "dir" : "sh",
                      m.pendingProofFile
                    );
                    if (ok) setStakeholderModal(null);
                  }}
                >
                  {stakeholderSaveKey && savingId === stakeholderSaveKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={bankModal !== null}
        onOpenChange={(open) => {
          if (!open) setBankModal(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {bankModal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {bankModal.index === null ? "Add bank account" : "Edit bank account"}
                </DialogTitle>
                <DialogDescription>
                  Enter account details and save to update entity banking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-1 w-full">
                  <Label>Bank name</Label>
                  <Input
                    className="w-full"
                    value={bankModal.draft.bankName}
                    onChange={(e) =>
                      setBankModal((m) =>
                        m ? { ...m, draft: { ...m.draft, bankName: e.target.value } } : m
                      )
                    }
                  />
                </div>
                <div className="space-y-1 w-full">
                  <Label>Account number</Label>
                  <Input
                    className="w-full"
                    value={bankModal.draft.accountNumber}
                    onChange={(e) =>
                      setBankModal((m) =>
                        m
                          ? { ...m, draft: { ...m.draft, accountNumber: e.target.value } }
                          : m
                      )
                    }
                  />
                </div>
                <div className="space-y-1 w-full">
                  <Label>Account signatories</Label>
                  <Textarea
                    className="w-full"
                    value={bankModal.draft.accountSignatories}
                    onChange={(e) =>
                      setBankModal((m) =>
                        m
                          ? {
                              ...m,
                              draft: { ...m.draft, accountSignatories: e.target.value },
                            }
                          : m
                      )
                    }
                    rows={2}
                    placeholder="Names of authorized signatories"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBankModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={savingBanks || (!leadId && !fineractClientId)}
                  onClick={async () => {
                    const bm = bankModal;
                    if (!bm) return;
                    const next =
                      bm.index === null
                        ? [...banks, { ...bm.draft, sortOrder: banks.length }]
                        : banks.map((b, i) =>
                            i === bm.index
                              ? {
                                  ...bm.draft,
                                  sortOrder: i,
                                  id: b.id,
                                }
                              : b
                          );
                    const ok = await persistBankAccounts(next);
                    if (ok) setBankModal(null);
                  }}
                >
                  {savingBanks ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div>
        <div className="space-y-3 mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Directors
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setStakeholderModal({
                kind: "dir",
                draft: emptyDirector(
                  directors.length
                    ? Math.max(...directors.map((x) => x.sortOrder)) + 1
                    : 0
                ),
                pendingProofFile: null,
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add director
          </Button>
        </div>
        <div className="space-y-2">
          {directors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No directors yet.</p>
          ) : (
            directors.map((r) => (
              <div
                key={r.id || `tmp-dir-${r.sortOrder}`}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-muted p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">
                    {r.fullName || "Unnamed director"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {r.nationalIdOrPassport || "—"}
                    {r.pepStatusLabel ? ` · PEP: ${r.pepStatusLabel}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setStakeholderModal({
                        kind: "dir",
                        draft: { ...r },
                        pendingProofFile: null,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeStakeholder(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="space-y-3 mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Shareholders
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setStakeholderModal({
                kind: "sh",
                draft: emptyShareholder(
                  shareholders.length
                    ? Math.max(...shareholders.map((x) => x.sortOrder)) + 1
                    : 0
                ),
                pendingProofFile: null,
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add shareholder
          </Button>
        </div>
        <div className="space-y-2">
          {shareholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shareholders yet.</p>
          ) : (
            shareholders.map((r) => (
              <div
                key={r.id || `tmp-sh-${r.sortOrder}`}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-muted p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">
                    {r.fullName || "Unnamed shareholder"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {r.nationalIdOrPassport || "—"}
                    {r.shareholdingPercentage
                      ? ` · ${r.shareholdingPercentage}%`
                      : ""}
                    {r.isUltimateBeneficialOwner ? " · UBO" : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setStakeholderModal({
                        kind: "sh",
                        draft: { ...r },
                        pendingProofFile: null,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeStakeholder(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="space-y-3 mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Entity banking
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() =>
              setBankModal({ draft: emptyBank(banks.length), index: null })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add account
          </Button>
        </div>
        <div className="space-y-2">
          {banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
          ) : (
            banks.map((b, idx) => (
              <div
                key={b.id || `bank-${idx}`}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-muted p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">
                    {b.bankName || "Bank account"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {b.accountNumber || "—"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBankModal({ draft: { ...b }, index: idx })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeBankAt(idx)}
                    disabled={savingBanks}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
