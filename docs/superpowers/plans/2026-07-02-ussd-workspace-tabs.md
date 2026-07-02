# USSD Workspace Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous USSD lead list with a two-tab workspace for USSD Applications and USSD Leads, where the leads tab shows pipeline-style lead records filtered to USSD-originated leads.

**Architecture:** Keep `/ussd-leads` as the single USSD workspace route. Render applications and leads as separate tabs, and reuse the existing pipeline lead view for the USSD Leads tab so the experience matches the main pipeline page. Add a small API/data filter so the lead query can return only leads whose `stateMetadata.source` is `USSD`, and forward that filter from the pipeline view to the paginated lead API.

**Tech Stack:** Next.js App Router, React, Prisma JSON filtering, existing shadcn/ui tabs and cards, existing pipeline view component.

---

### Task 1: Add a USSD-only lead filter to the lead data path

**Files:**
- Modify: `app/actions/leads-actions.ts`
- Modify: `app/api/leads/paginated/route.ts`

- [ ] **Step 1: Update the lead query options and filter**

```ts
// app/actions/leads-actions.ts
export async function getLeadsData(
  tenantSlug: string = "goodfellow",
  options: {
    stage?: string;
    status?: string;
    limit?: number;
    offset?: number;
    assignedToUserId?: number;
    loanOfficerFilter?: { oderId: number; userIdString: string };
    skipFineractStatus?: boolean;
    search?: string;
    leadStatus?: string;
    officeId?: number;
    source?: "USSD";
  } = {}
) {
  const { source } = options;

  if (source) {
    where.stateMetadata = {
      path: ["source"],
      equals: source,
    };
  }
}
```

- [ ] **Step 2: Forward the optional source query param through the API**

```ts
// app/api/leads/paginated/route.ts
const source = searchParams.get("source") || undefined;

const leadsData = await getLeadsData(tenantSlug, {
  stage,
  status,
  limit,
  offset,
  skipFineractStatus,
  search,
  leadStatus,
  source: source === "USSD" ? "USSD" : undefined,
  ...(isLoanOfficer && userId && userIdString && !officeScope
    ? { loanOfficerFilter: { oderId: userId, userIdString } }
    : {}),
  ...(officeScope?.officeId ? { officeId: officeScope.officeId } : {}),
});
```

- [ ] **Step 3: Verify the new filter is present**

Run: `node --import tsx --test lib/__tests__/ussd-workspace-tabs.test.ts`

Expected: PASS

### Task 2: Make the pipeline view reusable for USSD leads

**Files:**
- Modify: `app/(application)/leads/components/pipeline-view.tsx`

- [ ] **Step 1: Add a `source` prop and pass it into the fetch URL**

```ts
interface PipelineViewProps {
  initialData: LeadsData;
  source?: string;
  title?: string;
  description?: string;
  leadTitle?: string;
  leadDescription?: string;
}

const fetchLeads = async (page: number, filterValue: string) => {
  const params = new URLSearchParams({
    limit: pageSize.toString(),
    offset: offset.toString(),
  });

  if (source) {
    params.append("source", source);
  }
}
```

- [ ] **Step 2: Make the card titles configurable for the USSD workspace**

```tsx
<CardTitle>{title ?? "Sales Pipeline"}</CardTitle>
<CardDescription>{description ?? "Visualize your loan processing funnel"}</CardDescription>
...
<CardTitle>{leadTitle ?? "Pipeline Leads"}</CardTitle>
<CardDescription>{leadDescription ?? "View and manage leads in your pipeline"}</CardDescription>
```

### Task 3: Rebuild `/ussd-leads` as the two-tab workspace

**Files:**
- Modify: `app/(application)/ussd-leads/page.tsx`
- Modify: `app/(application)/leads/ussd/page.tsx`

- [ ] **Step 1: Load both USSD application data and USSD lead data on the server**

```ts
const [ussdLeadsData, ussdPipelineData] = await Promise.all([
  getUssdLeadsData(tenantSlug),
  getLeadsData(tenantSlug, { source: "USSD" }),
]);
```

- [ ] **Step 2: Render two tabs with the new labels**

```tsx
<Tabs defaultValue="applications" className="mt-6">
  <TabsList className="w-full overflow-x-auto">
    <TabsTrigger value="applications">USSD Applications</TabsTrigger>
    <TabsTrigger value="leads">USSD Leads</TabsTrigger>
  </TabsList>
</Tabs>
```

- [ ] **Step 3: Put the applications table in the Applications tab and the pipeline view in the Leads tab**

```tsx
<TabsContent value="applications">
  <UssdLoanApplicationsTable ussdLoanApplications={ussdLeadsData.applications} />
</TabsContent>

<TabsContent value="leads">
  <PipelineView
    initialData={ussdPipelineData}
    source="USSD"
    title="USSD Leads"
    description="Pipeline-style view of leads created from USSD applications"
    leadTitle="USSD Pipeline Leads"
    leadDescription="View and manage the lead records created from USSD applications"
  />
</TabsContent>
```

- [ ] **Step 4: Redirect the legacy `/leads/ussd` route to `/ussd-leads`**

```ts
// app/(application)/leads/ussd/page.tsx
import { redirect } from "next/navigation";

export default function LegacyUssdLeadsPage() {
  redirect("/ussd-leads");
}
```

### Task 4: Lock in the behavior with tests

**Files:**
- Add: `lib/__tests__/ussd-workspace-tabs.test.ts`

- [ ] **Step 1: Add source assertions for the new tab labels and pipeline source filter**

```ts
test("ussd workspace renders applications and pipeline-style leads tabs", () => {
  const pageSource = readRepoFile("app/(application)/ussd-leads/page.tsx");
  const pipelineSource = readRepoFile("app/(application)/leads/components/pipeline-view.tsx");
  const apiSource = readRepoFile("app/api/leads/paginated/route.ts");
  const leadsActionsSource = readRepoFile("app/actions/leads-actions.ts");

  assert.match(pageSource, /USSD Applications/);
  assert.match(pageSource, /USSD Leads/);
  assert.match(pageSource, /PipelineView/);
  assert.match(pipelineSource, /source\?: string;/);
  assert.match(pipelineSource, /params\.append\("source", source\)/);
  assert.match(apiSource, /const source = searchParams\.get\("source"\) \|\| undefined;/);
  assert.match(leadsActionsSource, /stateMetadata = \{\s*path: \["source"\],\s*equals: source/);
});
```

- [ ] **Step 2: Run the targeted test file**

Run: `node --import tsx --test lib/__tests__/ussd-workspace-tabs.test.ts`

Expected: PASS
