import Link from "next/link";
import {
  Building2,
  Download,
  FileText,
  Landmark,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EntityStakeholder = {
  id: string;
  role: "DIRECTOR" | "SHAREHOLDER";
  fullName: string;
  nationalIdOrPassport: string;
  residentialAddress: string;
  shareholdingPercentage?: unknown;
  isUltimateBeneficialOwner: boolean;
  pepStatusLabel?: string | null;
  controlStructureLabel?: string | null;
  nationalIdFineractDocumentId?: string | null;
  fineractDocumentId?: string | null;
  proofOfResidenceDocument?: {
    id: string;
    name?: string | null;
    originalName?: string | null;
  } | null;
};

type EntityBankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountSignatories: string;
};

type ClientDocument = {
  id: number | string;
  name?: string;
  fileName?: string;
  createdDate?: string;
  type?: string;
};

type FileLinkItem = {
  key: string;
  label: string;
  fileName: string;
  href: string;
  uploadedAt?: string;
};

function formatPercentage(value: unknown): string {
  if (value == null) return "Not specified";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}%`;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? `${parsed}%` : "Not specified";
  }

  if (typeof value === "object" && value && "toString" in value) {
    const parsed = Number.parseFloat((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? `${parsed}%` : "Not specified";
  }

  return "Not specified";
}

function formatDate(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildStakeholderFiles(
  stakeholder: EntityStakeholder,
  clientId: number,
  docsById: Map<string, ClientDocument>
): FileLinkItem[] {
  const items: FileLinkItem[] = [];
  const seenKeys = new Set<string>();

  const append = (item: FileLinkItem) => {
    if (seenKeys.has(item.key)) return;
    seenKeys.add(item.key);
    items.push(item);
  };

  if (stakeholder.nationalIdFineractDocumentId) {
    const id = stakeholder.nationalIdFineractDocumentId;
    const doc = docsById.get(String(id));
    append({
      key: `fineract-national-id-${id}`,
      label: "National ID / Passport",
      fileName: doc?.fileName || doc?.name || `Document #${id}`,
      href: `/api/fineract/clients/${clientId}/documents/${encodeURIComponent(
        String(id)
      )}/attachment`,
      uploadedAt: formatDate(doc?.createdDate),
    });
  }

  if (stakeholder.fineractDocumentId) {
    const id = stakeholder.fineractDocumentId;
    const doc = docsById.get(String(id));
    append({
      key: `fineract-proof-${id}`,
      label: "Proof of Residence",
      fileName: doc?.fileName || doc?.name || `Document #${id}`,
      href: `/api/fineract/clients/${clientId}/documents/${encodeURIComponent(
        String(id)
      )}/attachment`,
      uploadedAt: formatDate(doc?.createdDate),
    });
  }

  if (stakeholder.proofOfResidenceDocument?.id) {
    const localDoc = stakeholder.proofOfResidenceDocument;
    append({
      key: `local-proof-${localDoc.id}`,
      label: "Lead Proof of Residence",
      fileName:
        localDoc.name || localDoc.originalName || `Document ${localDoc.id}`,
      href: `/api/documents/${encodeURIComponent(localDoc.id)}`,
    });
  }

  return items;
}

function StakeholderCard({
  stakeholder,
  clientId,
  docsById,
}: {
  stakeholder: EntityStakeholder;
  clientId: number;
  docsById: Map<string, ClientDocument>;
}) {
  const uploadedFiles = buildStakeholderFiles(stakeholder, clientId, docsById);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {stakeholder.fullName || "Unnamed stakeholder"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              ID / Passport: {stakeholder.nationalIdOrPassport || "Not specified"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {stakeholder.pepStatusLabel && (
              <Badge variant="secondary">PEP: {stakeholder.pepStatusLabel}</Badge>
            )}
            {stakeholder.isUltimateBeneficialOwner && (
              <Badge className="bg-amber-600 text-white">UBO</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Shareholding
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatPercentage(stakeholder.shareholdingPercentage)}
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Control Structure
            </p>
            <p className="mt-1 text-sm font-medium">
              {stakeholder.controlStructureLabel || "Not specified"}
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Residential Address
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {stakeholder.residentialAddress || "Not specified"}
          </p>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Uploaded Files
          </p>
          {uploadedFiles.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No uploaded files recorded.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {uploadedFiles.map((file) => (
                <Link
                  key={file.key}
                  href={file.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.label}
                      {file.uploadedAt ? ` • ${file.uploadedAt}` : ""}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientEntityKyc({
  clientId,
  stakeholders,
  bankAccounts,
  clientDocuments = [],
}: {
  clientId: number;
  stakeholders: EntityStakeholder[];
  bankAccounts: EntityBankAccount[];
  clientDocuments?: ClientDocument[];
}) {
  const directors = stakeholders.filter((s) => s.role === "DIRECTOR");
  const shareholders = stakeholders.filter((s) => s.role === "SHAREHOLDER");
  const uboCount = shareholders.filter((s) => s.isUltimateBeneficialOwner).length;
  const docsById = new Map(
    clientDocuments.map((doc) => [String(doc.id), doc] as const)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Directors</p>
              <p className="text-2xl font-semibold">{directors.length}</p>
            </div>
            <UserCircle className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Shareholders</p>
              <p className="text-2xl font-semibold">{shareholders.length}</p>
            </div>
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">UBO Records</p>
              <p className="text-2xl font-semibold">{uboCount}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Bank Accounts</p>
              <p className="text-2xl font-semibold">{bankAccounts.length}</p>
            </div>
            <Landmark className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="h-5 w-5" />
            Directors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {directors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No directors recorded.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {directors.map((director) => (
                <StakeholderCard
                  key={director.id}
                  stakeholder={director}
                  clientId={clientId}
                  docsById={docsById}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Shareholders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shareholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shareholders recorded.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {shareholders.map((shareholder) => (
                <StakeholderCard
                  key={shareholder.id}
                  stakeholder={shareholder}
                  clientId={clientId}
                  docsById={docsById}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-5 w-5" />
            Entity Banking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entity bank accounts recorded.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-lg border bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{account.bankName || "Unnamed bank"}</p>
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Account:</span>{" "}
                    {account.accountNumber || "Not specified"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    Signatories: {account.accountSignatories || "Not specified"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
