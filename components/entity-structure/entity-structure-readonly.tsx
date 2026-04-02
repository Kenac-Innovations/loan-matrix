"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Landmark, UserCircle } from "lucide-react";

export type ReadonlyStakeholder = {
  id: string;
  role: "DIRECTOR" | "SHAREHOLDER";
  fullName: string;
  nationalIdOrPassport: string;
  residentialAddress: string;
  shareholdingPercentage?: unknown;
  isUltimateBeneficialOwner: boolean;
  pepStatusLabel?: string | null;
  controlStructureLabel?: string | null;
  proofOfResidenceDocument?: { name: string; id: string } | null;
};

export type ReadonlyBankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountSignatories: string;
};

export function EntityStructureReadonly({
  stakeholders,
  bankAccounts,
}: {
  stakeholders: ReadonlyStakeholder[];
  bankAccounts: ReadonlyBankAccount[];
}) {
  const directors = stakeholders.filter((s) => s.role === "DIRECTOR");
  const shareholders = stakeholders.filter((s) => s.role === "SHAREHOLDER");

  return (
    <div className="space-y-6 col-span-full md:col-span-2 lg:col-span-3">
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
            <ul className="space-y-4">
              {directors.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="font-medium">{d.fullName}</div>
                  <div className="text-muted-foreground">
                    ID / Passport: {d.nationalIdOrPassport}
                  </div>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {d.residentialAddress}
                  </div>
                  {d.pepStatusLabel && (
                    <div>
                      PEP: <Badge variant="secondary">{d.pepStatusLabel}</Badge>
                    </div>
                  )}
                  {d.proofOfResidenceDocument && (
                    <div className="text-xs text-muted-foreground">
                      Proof: {d.proofOfResidenceDocument.name}
                    </div>
                  )}
                </li>
              ))}
            </ul>
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
            <ul className="space-y-4">
              {shareholders.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.fullName}</span>
                    {s.isUltimateBeneficialOwner && (
                      <Badge className="bg-amber-600">UBO</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    ID / Passport: {s.nationalIdOrPassport}
                  </div>
                  {s.shareholdingPercentage != null && (
                    <div>
                      Shareholding:{" "}
                      {String(s.shareholdingPercentage)}%
                    </div>
                  )}
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {s.residentialAddress}
                  </div>
                  {s.pepStatusLabel && (
                    <div>
                      PEP: <Badge variant="secondary">{s.pepStatusLabel}</Badge>
                    </div>
                  )}
                  {s.isUltimateBeneficialOwner && s.controlStructureLabel && (
                    <div>
                      Control structure:{" "}
                      <span className="font-medium">{s.controlStructureLabel}</span>
                    </div>
                  )}
                  {s.proofOfResidenceDocument && (
                    <div className="text-xs text-muted-foreground">
                      Proof: {s.proofOfResidenceDocument.name}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-5 w-5" />
            Entity banking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entity bank accounts recorded.
            </p>
          ) : (
            <ul className="space-y-4">
              {bankAccounts.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="font-medium">{b.bankName}</div>
                  <div>Account: {b.accountNumber}</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    Signatories: {b.accountSignatories || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
