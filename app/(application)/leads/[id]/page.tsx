import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LeadTimeline } from "./components/lead-timeline";
import { LeadDetails } from "./components/lead-details";
import { LeadDocuments } from "./components/lead-documents";
import { LeadActions } from "./components/lead-actions";
import { LeadValidations } from "./components/lead-validations";
import { LeadAffordability } from "./components/lead-affordability";
import {
  ArrowLeft,
  Clock,
  FileText,
  MessageSquare,
  Activity,
  ShieldCheck,
  ArrowRight,
  Calculator,
} from "lucide-react";
import Link from "next/link";

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  // In a real app, you would fetch the current stage from the API
  const currentStage = "Credit Assessment";

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="h-8 w-8 border-[#1a2035]"
          >
            <Link href="/leads">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to leads</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Lead #{params.id}
              </h2>
              <Badge className="bg-yellow-500 text-white border-0">
                In Progress
              </Badge>
            </div>
            <p className="text-gray-400">Business Loan - $125,000</p>
          </div>
        </div>
        <LeadActions leadId={params.id} />
      </div>

      <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="bg-[#0d121f] border border-[#1a2035] w-full sm:w-auto overflow-x-auto">
              <TabsTrigger
                value="details"
                className="data-[state=active]:bg-blue-500"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Details</span>
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="data-[state=active]:bg-blue-500"
              >
                <Activity className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Timeline</span>
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="data-[state=active]:bg-blue-500"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Documents</span>
              </TabsTrigger>
              <TabsTrigger
                value="validations"
                className="data-[state=active]:bg-blue-500"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Validations</span>
              </TabsTrigger>
              <TabsTrigger
                value="communication"
                className="data-[state=active]:bg-blue-500"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Communication</span>
              </TabsTrigger>
              <TabsTrigger
                value="affordability"
                className="data-[state=active]:bg-blue-500"
              >
                <Calculator className="mr-2 h-4 w-4" />
                <span className="whitespace-nowrap">Affordability</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <LeadDetails leadId={params.id} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <Card className="border-[#1a2035] bg-[#0d121f] text-white">
                <CardHeader>
                  <CardTitle>Lead Timeline</CardTitle>
                  <CardDescription className="text-gray-400">
                    Track the progress of this lead through the pipeline
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadTimeline leadId={params.id} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <LeadDocuments leadId={params.id} />
            </TabsContent>
            <TabsContent value="validations" className="mt-4">
              <LeadValidations leadId={params.id} stage={currentStage} />
            </TabsContent>
            <TabsContent value="communication" className="mt-4">
              <Card className="border-[#1a2035] bg-[#0d121f] text-white">
                <CardHeader>
                  <CardTitle>Communication History</CardTitle>
                  <CardDescription className="text-gray-400">
                    All communications with the client
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-40">
                    <p className="text-gray-400">
                      Communication history will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="affordability" className="mt-4">
              <LeadAffordability leadId={params.id} />
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <Card className="border-[#1a2035] bg-[#0d121f] text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Turn-Around Time
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Current Stage</span>
                    <span className="text-xs font-medium text-blue-400">
                      Credit Assessment
                    </span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Time in Stage</span>
                    <span className="text-xs font-medium text-yellow-400">
                      2d 4h (SLA: 3d)
                    </span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">Total Time</span>
                    <span className="text-xs font-medium text-green-400">
                      5d 7h
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#1a2035]">
                  <h4 className="text-xs font-semibold mb-2">
                    Stage TAT Performance
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Lead Qualification</span>
                        <span className="text-xs text-green-400">
                          1d 2h (SLA: 2d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Document Collection</span>
                        <span className="text-xs text-green-400">
                          2d 1h (SLA: 3d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Credit Assessment</span>
                        <span className="text-xs text-yellow-400">
                          2d 4h (SLA: 3d)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Approval</span>
                        <span className="text-xs text-gray-400">Pending</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">Disbursement</span>
                        <span className="text-xs text-gray-400">Pending</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add validation summary card to the sidebar */}
          <Card className="border-[#1a2035] bg-[#0d121f] text-white mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Validation Summary
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Required Fields</span>
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Document Verification</span>
                  <Badge className="bg-red-500 text-white">Failed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Budget Information</span>
                  <Badge className="bg-yellow-500 text-white">Warning</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Contact Information</span>
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Credit Score</span>
                  <Badge className="bg-yellow-500 text-white">Warning</Badge>
                </div>
                <div className="pt-3 mt-3 border-t border-[#1a2035]">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-[#2a304d] text-blue-400 hover:bg-[#1a2035] hover:text-blue-300"
                    asChild
                  >
                    <a href={`/leads/${params.id}?tab=validations`}>
                      View All Validations
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#1a2035] bg-[#0d121f] text-white mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Assigned Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">JD</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">John Doe</p>
                      <p className="text-xs text-gray-400">Lead Qualifier</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-500 bg-green-500/10 text-green-400"
                  >
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">AS</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Alice Smith</p>
                      <p className="text-xs text-gray-400">
                        Document Specialist
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-500 bg-green-500/10 text-green-400"
                  >
                    Completed
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">RJ</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Robert Johnson</p>
                      <p className="text-xs text-gray-400">Credit Analyst</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  >
                    In Progress
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
