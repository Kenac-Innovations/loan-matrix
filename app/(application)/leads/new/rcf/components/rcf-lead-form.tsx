"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientRegistrationForm } from "../../components/client-registration-form";
import { SimplifiedAffordabilityForm } from "../../components/simplified-affordability-form";
import { RcfContracts } from "./rcf-contracts";
import { RcfFacilityTermsForm } from "./rcf-facility-terms-form";
import { useCurrency } from "@/contexts/currency-context";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RcfLeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useCurrency();
  const skipAffordability = !!locale.skipAffordabilityForCompanies;

  const [activeTab, setActiveTab] = useState("client");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [fineractClientId, setFineractClientId] = useState<number | null>(null);
  const [clientCreatedInFineract, setClientCreatedInFineract] = useState(false);
  const [allClientSectionsComplete, setAllClientSectionsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore draft lead from URL ?id= param
  useEffect(() => {
    const draftId = searchParams?.get("id") || searchParams?.get("leadId");
    if (draftId && !leadId) {
      setLeadId(draftId);
      setAllClientSectionsComplete(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load template data (offices, legalForms, etc.) same as loan wizard
  const { data: templateResult, error: templateError } = useSWR("/api/leads/template", fetcher);
  const rawTemplate = templateResult?.data ?? {};
  const clientFormData = {
    ...rawTemplate,
    activationDate: rawTemplate.activationDate
      ? new Date(rawTemplate.activationDate)
      : null,
  };

  const allTabs = [
    { value: "client", label: "Client Details", shortLabel: "Client" },
    { value: "affordability", label: "Affordability", shortLabel: "CDE" },
    { value: "facility", label: "Facility Terms", shortLabel: "Facility" },
    { value: "contracts", label: "Contracts", shortLabel: "Contracts" },
  ];

  const effectiveTabs = skipAffordability
    ? allTabs.filter((t) => t.value !== "affordability")
    : allTabs;

  const goNext = () => {
    const idx = effectiveTabs.findIndex((t) => t.value === activeTab);
    if (idx < effectiveTabs.length - 1) setActiveTab(effectiveTabs[idx + 1].value);
  };

  const goBack = () => {
    const idx = effectiveTabs.findIndex((t) => t.value === activeTab);
    if (idx > 0) setActiveTab(effectiveTabs[idx - 1].value);
  };

  const isTabLocked = (tabValue: string) => tabValue !== "client" && !leadId;

  const handleContractsComplete = () => {
    if (leadId) router.push(`/leads/${leadId}`);
  };

  if (templateError) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 font-medium">Error loading form data: {templateError.message}</p>
      </div>
    );
  }

  if (!templateResult) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-shrink-0 px-2 py-2 lg:px-6 lg:py-6 border-b bg-background">
          <Skeleton className="h-7 w-64 mb-1" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex-1 px-2 py-2 lg:px-6 lg:py-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-shrink-0 px-2 py-2 lg:px-6 lg:py-6 border-b bg-background">
        <h1 className="text-lg lg:text-2xl font-bold tracking-tight">
          New Revolving Credit Facility
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete each section to create the facility application.
        </p>
      </div>

      <div className="flex-1 px-2 py-2 lg:px-6 lg:py-6">
        <Tabs value={activeTab} onValueChange={() => {}} className="space-y-4">
          <TabsList className="w-full" style={{ gridTemplateColumns: `repeat(${effectiveTabs.length}, 1fr)`, display: "grid" }}>
            {effectiveTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={isTabLocked(tab.value)}
                className="flex-1"
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Client Tab — mirrors loan wizard exactly */}
          <TabsContent value="client" className="mt-0" forceMount>
            <Card className="px-2 py-2 lg:px-6 lg:py-6">
              <CardHeader className="px-2 lg:px-6">
                <CardTitle>Client Information</CardTitle>
                <CardDescription>
                  Enter the client&apos;s personal and contact information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-2 lg:px-6">
                <ClientRegistrationForm
                  leadId={leadId ?? undefined}
                  formData={clientFormData}
                  clientCreatedInFineract={clientCreatedInFineract}
                  isSubmitting={isSubmitting}
                  facilityType="REVOLVING_CREDIT"
                  onAllSectionsComplete={setAllClientSectionsComplete}
                  draftUrlBase="/leads/new/rcf"
                  onLeadIdChange={(newLeadId) => {
                    setLeadId(newLeadId);
                  }}
                  onClientCreated={() => {
                    setClientCreatedInFineract(true);
                    // Capture fineractClientId from window (set by ClientRegistrationForm)
                    if ((window as any).fineractClientId) {
                      setFineractClientId((window as any).fineractClientId);
                    }
                  }}
                  setClientCreatedInFineract={(val) => {
                    setClientCreatedInFineract(val);
                    if (val && (window as any).fineractClientId) {
                      setFineractClientId((window as any).fineractClientId);
                    }
                  }}
                  setFormCompletionStatus={() => {}}
                />

                {/* Next button — same pattern as loan wizard */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    className={`w-full sm:w-auto ${
                      clientCreatedInFineract && allClientSectionsComplete
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    disabled={!clientCreatedInFineract || !allClientSectionsComplete}
                    onClick={() =>
                      setActiveTab(skipAffordability ? "facility" : "affordability")
                    }
                  >
                    {!clientCreatedInFineract
                      ? "Complete Client Registration First"
                      : !allClientSectionsComplete
                      ? "Complete All Client Tabs"
                      : `✓ All Tabs Complete — Next: ${skipAffordability ? "Facility Terms" : "Affordability"}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affordability Tab */}
          {!skipAffordability && (
            <TabsContent value="affordability" className="mt-0" forceMount>
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Affordability Assessment</CardTitle>
                  <CardDescription>
                    Capture affordability details for the client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 lg:px-6">
                  <SimplifiedAffordabilityForm
                    leadId={leadId ?? undefined}
                    onComplete={goNext}
                    onBack={goBack}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Facility Terms Tab */}
          <TabsContent value="facility" className="mt-0" forceMount>
            <Card className="px-2 py-2 lg:px-6 lg:py-6">
              <CardHeader className="px-2 lg:px-6">
                <CardTitle>Facility Terms</CardTitle>
                <CardDescription>
                  Configure the revolving credit facility parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                {leadId ? (
                  <RcfFacilityTermsForm
                    leadId={leadId}
                    fineractClientId={fineractClientId}
                    onComplete={goNext}
                    onBack={goBack}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Please complete client registration first.
                    </p>
                    <Button onClick={() => setActiveTab("client")}>
                      Go to Client Details
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-0" forceMount>
            <Card className="px-2 py-2 lg:px-6 lg:py-6">
              <CardHeader className="px-2 lg:px-6">
                <CardTitle>Contracts</CardTitle>
                <CardDescription>
                  Generate and sign facility contracts.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                <RcfContracts
                  leadId={leadId ?? undefined}
                  onComplete={handleContractsComplete}
                  onBack={goBack}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
