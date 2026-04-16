"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  nationalIdFineractDocumentId: string;
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
    nationalIdFineractDocumentId: s.nationalIdFineractDocumentId ?? "",
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
    nationalIdFineractDocumentId: "",
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
    nationalIdFineractDocumentId: "",
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

function parseAccountSignatories(value: string): string[] {
  const parsed = value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [""];
}

function serializeAccountSignatories(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function getStakeholderFormError(draft: StakeholderRow): string | null {
  if (!draft.fullName.trim()) return "Full name is required.";
  if (!draft.nationalIdOrPassport.trim()) {
    return "National ID or passport is required.";
  }
  if (!draft.residentialAddress.trim()) {
    return "Residential address is required.";
  }
  if (
    draft.role === "SHAREHOLDER" &&
    String(draft.shareholdingPercentage ?? "").trim() === ""
  ) {
    return "Shareholding percentage is required.";
  }
  return null;
}

function getBankFormError(draft: BankRow, signatories: string[]): string | null {
  if (!draft.bankName.trim()) return "Bank name is required.";
  if (!draft.accountNumber.trim()) return "Account number is required.";
  if (signatories.some((item) => !item.trim())) {
    return "Each signatory field must be completed or removed.";
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

type StakeholderDocumentType = "NATIONAL_ID" | "PROOF_OF_RESIDENCE";

function buildStakeholderDocumentName(
  row: StakeholderRow,
  documentType: StakeholderDocumentType
): string {
  const rolePrefix = row.role === "DIRECTOR" ? "DIRECTOR" : "SHAREHOLDER";
  const subject = sanitizeDocNamePart(
    row.fullName || row.nationalIdOrPassport || "STAKEHOLDER"
  );
  return `${rolePrefix}_${documentType}_${subject}`;
}

function buildStakeholderDocumentDescription(
  row: StakeholderRow,
  documentType: StakeholderDocumentType
): string {
  const roleLabel = row.role === "DIRECTOR" ? "Director" : "Shareholder";
  const documentLabel =
    documentType === "NATIONAL_ID"
      ? "national ID/passport document"
      : "proof of residence document";
  const person = row.fullName?.trim();
  const identity = row.nationalIdOrPassport?.trim();

  return [
    `${roleLabel} ${documentLabel} uploaded from entity KYC`,
    person ? `Name: ${person}` : null,
    identity ? `ID: ${identity}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function stakeholderDraftKey(row: Pick<
  StakeholderRow,
  "role" | "sortOrder" | "fullName" | "nationalIdOrPassport"
>): string {
  return [
    row.role,
    String(row.sortOrder ?? 0),
    row.fullName?.trim().toUpperCase() || "",
    row.nationalIdOrPassport?.trim().toUpperCase() || "",
  ].join("|");
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
  persistMode = "immediate",
  onDraftChange,
}: {
  leadId: string | null;
  fineractClientId?: number | null;
  initialStakeholders: any[];
  initialBankAccounts: any[];
  onRefresh: () => Promise<void>;
  persistMode?: "immediate" | "deferred";
  onDraftChange?: (payload: {
    stakeholders: any[];
    bankAccounts: any[];
  }) => void;
}) {
  const { toast } = useToast();
  const isDeferredMode = persistMode === "deferred";
  const [pepOptions, setPepOptions] = useState<CodeOpt[]>([]);
  const [controlOptions, setControlOptions] = useState<CodeOpt[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingBanks, setSavingBanks] = useState(false);
  const [stakeholderModal, setStakeholderModal] = useState<null | {
    kind: "dir" | "sh";
    draft: StakeholderRow;
    pendingProofFile: File | null;
    pendingNationalIdFile: File | null;
  }>(null);
  const [bankModal, setBankModal] = useState<null | {
    draft: BankRow;
    index: number | null;
    signatories: string[];
  }>(null);

  const [directors, setDirectors] = useState<StakeholderRow[]>([]);
  const [shareholders, setShareholders] = useState<StakeholderRow[]>([]);
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [pendingNationalIdFilesByKey, setPendingNationalIdFilesByKey] =
    useState<Record<string, File>>({});
  const [isSyncingDeferredNationalIds, setIsSyncingDeferredNationalIds] =
    useState(false);
  const isSyncingDeferredNationalIdsRef = useRef(false);

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

  const emitDraftChange = useCallback(
    (
      nextDirectors: StakeholderRow[],
      nextShareholders: StakeholderRow[],
      nextBanks: BankRow[]
    ) => {
      if (!onDraftChange) return;
      onDraftChange({
        stakeholders: [...nextDirectors, ...nextShareholders],
        bankAccounts: nextBanks,
      });
    },
    [onDraftChange]
  );

  const uploadProofToFineract = useCallback(
    async (row: StakeholderRow, file: File): Promise<string> => {
      if (!fineractClientId) {
        throw new Error("Fineract client ID is required to upload proof of residence.");
      }

      const formData = new FormData();
      formData.append("name", buildStakeholderDocumentName(row, "PROOF_OF_RESIDENCE"));
      formData.append(
        "description",
        buildStakeholderDocumentDescription(row, "PROOF_OF_RESIDENCE")
      );
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

  const uploadNationalIdToFineract = useCallback(
    async (row: StakeholderRow, file: File): Promise<string> => {
      if (!fineractClientId) {
        throw new Error("Fineract client ID is required to upload national ID.");
      }

      const formData = new FormData();
      formData.append("name", buildStakeholderDocumentName(row, "NATIONAL_ID"));
      formData.append(
        "description",
        buildStakeholderDocumentDescription(row, "NATIONAL_ID")
      );
      formData.append("file", file);

      const res = await fetch(`/api/fineract/clients/${fineractClientId}/documents`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : "Failed to upload national ID to Fineract"
        );
      }
      const documentId = extractFineractDocumentId(json);
      if (!documentId) {
        throw new Error(
          "National ID upload succeeded but no document ID was returned."
        );
      }
      return documentId;
    },
    [fineractClientId]
  );

  const saveStakeholder = async (
    row: StakeholderRow,
    list: "dir" | "sh",
    pendingProofFile: File | null,
    pendingNationalIdFile: File | null
  ): Promise<boolean> => {
    if (isDeferredMode) {
      const key = stakeholderDraftKey(row);
      const hasQueuedNationalId = Boolean(pendingNationalIdFilesByKey[key]);
      if (
        !pendingNationalIdFile &&
        !row.nationalIdFineractDocumentId?.trim() &&
        !hasQueuedNationalId
      ) {
        toast({
          variant: "destructive",
          title: "National ID required",
          description:
            "Select a national ID file before saving this stakeholder.",
        });
        return false;
      }

      const draftId = row.id || `draft-${Math.random().toString(36).slice(2, 11)}`;
      const normalizedRow = { ...row, id: draftId };
      if (pendingNationalIdFile) {
        const normalizedKey = stakeholderDraftKey(normalizedRow);
        setPendingNationalIdFilesByKey((prev) => ({
          ...prev,
          [normalizedKey]: pendingNationalIdFile,
        }));
      }
      if (list === "dir") {
        const existingIdx = directors.findIndex((x) => x.id === normalizedRow.id);
        const nextDirectors =
          existingIdx >= 0
            ? directors.map((x, idx) => (idx === existingIdx ? normalizedRow : x))
            : [...directors, normalizedRow];
        setDirectors(nextDirectors);
        emitDraftChange(nextDirectors, shareholders, banks);
      } else {
        const existingIdx = shareholders.findIndex((x) => x.id === normalizedRow.id);
        const nextShareholders =
          existingIdx >= 0
            ? shareholders.map((x, idx) => (idx === existingIdx ? normalizedRow : x))
            : [...shareholders, normalizedRow];
        setShareholders(nextShareholders);
        emitDraftChange(directors, nextShareholders, banks);
      }
      return true;
    }

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
      if (pendingProofFile && fineractClientId) {
        fineractDocumentId = await uploadProofToFineract(row, pendingProofFile);
      }

      let nationalIdFineractDocumentId =
        row.nationalIdFineractDocumentId?.trim() || null;
      if (pendingNationalIdFile && fineractClientId) {
        nationalIdFineractDocumentId = await uploadNationalIdToFineract(
          row,
          pendingNationalIdFile
        );
      }
      if (!nationalIdFineractDocumentId) {
        toast({
          variant: "destructive",
          title: "National ID required",
          description:
            "Select a national ID file before saving this stakeholder.",
        });
        return false;
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
          nationalIdFineractDocumentId,
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
    if (isDeferredMode) {
      const key = stakeholderDraftKey(row);
      setPendingNationalIdFilesByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (row.role === "DIRECTOR") {
        const nextDirectors = directors.filter((x) => x.id !== row.id);
        setDirectors(nextDirectors);
        emitDraftChange(nextDirectors, shareholders, banks);
      } else {
        const nextShareholders = shareholders.filter((x) => x.id !== row.id);
        setShareholders(nextShareholders);
        emitDraftChange(directors, nextShareholders, banks);
      }
      return;
    }

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
    if (isDeferredMode) {
      setBanks(next);
      emitDraftChange(directors, shareholders, next);
      return true;
    }

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

  const patchBankSignatories = (values: string[]) => {
    setBankModal((m) =>
      m
        ? {
            ...m,
            signatories: values,
            draft: {
              ...m.draft,
              accountSignatories: serializeAccountSignatories(values),
            },
          }
        : m
    );
  };

  useEffect(() => {
    if (isDeferredMode || !leadId || !fineractClientId) return;
    const pendingKeys = Object.keys(pendingNationalIdFilesByKey);
    if (pendingKeys.length === 0) return;
    if (isSyncingDeferredNationalIdsRef.current) return;

    let cancelled = false;
    const syncDeferredNationalIds = async () => {
      isSyncingDeferredNationalIdsRef.current = true;
      setIsSyncingDeferredNationalIds(true);
      try {
        const leadRes = await fetch(`/api/leads/${leadId}`);
        if (!leadRes.ok) {
          throw new Error("Failed to load lead for national ID sync.");
        }
        const lead = await leadRes.json();
        const persistedStakeholders = Array.isArray(lead?.entityStakeholders)
          ? lead.entityStakeholders
          : [];

        const syncedKeys: string[] = [];
        for (const rawRow of persistedStakeholders) {
          const row = mapStakeholderToRow(rawRow);
          const key = stakeholderDraftKey(row);
          const file = pendingNationalIdFilesByKey[key];
          if (!file) continue;

          const nationalIdDocId = await uploadNationalIdToFineract(row, file);
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
              nationalIdFineractDocumentId: nationalIdDocId,
              fineractDocumentId: row.fineractDocumentId || null,
              proofOfResidenceLeadDocumentId:
                row.proofOfResidenceLeadDocumentId || null,
              pepStatusCodeValueId: row.pepStatusCodeValueId
                ? Number(row.pepStatusCodeValueId)
                : null,
              pepStatusLabel: row.pepStatusLabel || null,
              shareholdingPercentage:
                row.role === "SHAREHOLDER" && row.shareholdingPercentage !== ""
                  ? Number(row.shareholdingPercentage)
                  : null,
              isUltimateBeneficialOwner:
                row.role === "SHAREHOLDER"
                  ? row.isUltimateBeneficialOwner
                  : false,
              controlStructureCodeValueId:
                row.role === "SHAREHOLDER" && row.isUltimateBeneficialOwner
                  ? row.controlStructureCodeValueId
                    ? Number(row.controlStructureCodeValueId)
                    : null
                  : null,
              controlStructureLabel:
                row.role === "SHAREHOLDER" && row.isUltimateBeneficialOwner
                  ? row.controlStructureLabel || null
                  : null,
              sortOrder: row.sortOrder,
            },
          });
          syncedKeys.push(key);
        }

        if (syncedKeys.length > 0) {
          setPendingNationalIdFilesByKey((prev) => {
            const next = { ...prev };
            for (const key of syncedKeys) {
              delete next[key];
            }
            return next;
          });
          await onRefresh();
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "National ID sync failed",
            description:
              e?.message || "Failed to upload deferred national ID files.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsSyncingDeferredNationalIds(false);
        }
        isSyncingDeferredNationalIdsRef.current = false;
      }
    };

    syncDeferredNationalIds();

    return () => {
      cancelled = true;
    };
  }, [
    fineractClientId,
    isDeferredMode,
    leadId,
    onRefresh,
    pendingNationalIdFilesByKey,
    toast,
    uploadNationalIdToFineract,
  ]);

  if (!isDeferredMode && !leadId && !fineractClientId) {
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
  const bankSignatories = bankModal
    ? bankModal.signatories
    : [""];

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
                      <span className="text-destructive"> *</span>
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
                      required
                    />
                  </div>
                  <div className="space-y-1 w-full">
                    <Label>
                      National ID / Passport
                      <span className="text-destructive"> *</span>
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
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1 w-full">
                  <Label>
                    Residential address
                    <span className="text-destructive"> *</span>
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
                    required
                  />
                </div>
                {stakeholderModal.kind === "sh" && (
                  <div className="space-y-1 w-full">
                    <Label>
                      Shareholding %<span className="text-destructive"> *</span>
                    </Label>
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
                      required
                    />
                  </div>
                )}
                <div className="space-y-2 w-full">
                  <Label>
                    National ID file<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = "";
                      setStakeholderModal((m) =>
                        m ? { ...m, pendingNationalIdFile: f } : m
                      );
                    }}
                    required
                  />
                  {stakeholderModal.pendingNationalIdFile && (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        Selected file: {stakeholderModal.pendingNationalIdFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() =>
                          setStakeholderModal((m) =>
                            m ? { ...m, pendingNationalIdFile: null } : m
                          )
                        }
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  {stakeholderModal.draft.nationalIdFineractDocumentId && (
                    <div className="text-xs text-muted-foreground">
                      Existing National ID document ID:{" "}
                      {stakeholderModal.draft.nationalIdFineractDocumentId}
                    </div>
                  )}
                </div>
                <div className="space-y-2 w-full">
                  <Label>
                    Proof of residence
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
                </div>
                <div className="space-y-1 w-full">
                  <Label>PEP status</Label>
                  <Select
                    value={
                      stakeholderModal.draft.pepStatusCodeValueId
                        ? stakeholderModal.draft.pepStatusCodeValueId
                        : "__none__"
                    }
                    onValueChange={(v) => {
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
                      <SelectItem value="__none__">None</SelectItem>
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
                    (!isDeferredMode && !leadId && !fineractClientId)
                  }
                  onClick={async () => {
                    const m = stakeholderModal;
                    if (!m) return;
                    const err = getStakeholderFormError(m.draft);
                    if (err) {
                      toast({
                        variant: "destructive",
                        title: "Required fields",
                        description: err,
                      });
                      return;
                    }
                    const ok = await saveStakeholder(
                      m.draft,
                      m.kind === "dir" ? "dir" : "sh",
                      m.pendingProofFile,
                      m.pendingNationalIdFile
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
                  <Label>
                    Bank name<span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    className="w-full"
                    value={bankModal.draft.bankName}
                    onChange={(e) =>
                      setBankModal((m) =>
                        m ? { ...m, draft: { ...m.draft, bankName: e.target.value } } : m
                      )
                    }
                    required
                  />
                </div>
                <div className="space-y-1 w-full">
                  <Label>
                    Account number<span className="text-destructive"> *</span>
                  </Label>
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
                    required
                  />
                </div>
                <div className="space-y-1 w-full">
                  <Label>
                    Account signatories<span className="text-destructive"> *</span>
                  </Label>
                  <div className="space-y-2">
                    {bankSignatories.map((signatory, index) => (
                      <div key={`signatory-${index}`} className="flex items-center gap-2">
                        <Input
                          className="w-full"
                          value={signatory}
                          onChange={(e) => {
                            const next = [...bankSignatories];
                            next[index] = e.target.value;
                            patchBankSignatories(next);
                          }}
                          placeholder={`Signatory ${index + 1}`}
                          required
                        />
                        {bankSignatories.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const next = bankSignatories.filter((_, i) => i !== index);
                              patchBankSignatories(next.length ? next : [""]);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove signatory</span>
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => patchBankSignatories([...bankSignatories, ""])}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add signatory
                    </Button>
                  </div>
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
                  disabled={
                    savingBanks || (!isDeferredMode && !leadId && !fineractClientId)
                  }
                  onClick={async () => {
                    const bm = bankModal;
                    if (!bm) return;
                    const err = getBankFormError(bm.draft, bm.signatories);
                    if (err) {
                      toast({
                        variant: "destructive",
                        title: "Required fields",
                        description: err,
                      });
                      return;
                    }
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
        {isSyncingDeferredNationalIds && (
          <p className="text-sm text-muted-foreground mb-3">
            Syncing pending national ID files...
          </p>
        )}
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
                pendingNationalIdFile: null,
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
                        pendingNationalIdFile: null,
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
                pendingNationalIdFile: null,
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
                        pendingNationalIdFile: null,
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
              setBankModal({
                draft: emptyBank(banks.length),
                index: null,
                signatories: [""],
              })
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
                      setBankModal({
                        draft: { ...b },
                        index: idx,
                        signatories: parseAccountSignatories(b.accountSignatories),
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
