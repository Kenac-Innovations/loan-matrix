import { notFound } from "next/navigation";
import { CreditCard, Receipt, FileSpreadsheet, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { ClientDetails } from "./components/client-details";
import { ClientLoans } from "./components/client-loans";
import { ClientTransactions } from "./components/client-transactions";
import { ClientDocuments } from "./components/client-documents";
import { ClientAdditionalInfo } from "./components/client-additional-info";
import { ClientHeader } from "./components/client-header";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Fetch client data from Fineract
 */
async function getClientData(clientId: number) {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      console.warn("No access token available for client fetch");
      return null;
    }

    const fineractTenantId = await getFineractTenantId();

    const response = await fetch(
      `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch client ${clientId}:`, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching client data:", error);
    return null;
  }
}

/**
 * Fetch client image from Fineract
 */
async function getClientImage(clientId: number): Promise<string | null> {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return null;
    }

    const fineractTenantId = await getFineractTenantId();

    const response = await fetch(
      `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}/images?maxHeight=200`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json, text/plain, */*",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type");
    let imageData: any;

    if (contentType?.includes("application/json")) {
      imageData = await response.json();
    } else {
      imageData = await response.text();
    }

    if (!imageData) return null;

    // Helper to check if string looks like base64
    const isBase64Like = (str: string): boolean => {
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      return base64Regex.test(str) && str.length > 10;
    };

    // Convert to data URI
    if (typeof imageData === "string") {
      if (imageData.startsWith("data:image/")) {
        return imageData;
      } else if (isBase64Like(imageData)) {
        return `data:image/jpeg;base64,${imageData}`;
      }
    } else if (imageData?.imageData) {
      if (imageData.imageData.startsWith("data:image/")) {
        return imageData.imageData;
      } else if (isBase64Like(imageData.imageData)) {
        return `data:image/jpeg;base64,${imageData.imageData}`;
      }
    } else if (imageData?.base64EncodedImage) {
      if (imageData.base64EncodedImage.startsWith("data:image/")) {
        return imageData.base64EncodedImage;
      } else if (isBase64Like(imageData.base64EncodedImage)) {
        return `data:image/jpeg;base64,${imageData.base64EncodedImage}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching client image:", error);
    return null;
  }
}

/**
 * Fetch datatables list for clients
 */
async function getDatatables() {
  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      console.warn("No access token available for datatables fetch");
      return [];
    }

    const fineractTenantId = await getFineractTenantId();

    const response = await fetch(
      `${FINERACT_BASE_URL}/fineract-provider/api/v1/datatables?apptable=m_client`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch datatables:", response.status);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching datatables:", error);
    return [];
  }
}

/**
 * Fetch datatable data for a specific client
 */
async function getDatatableData(
  clientId: number,
  datatables: any[]
): Promise<Record<string, any>> {
  const datatableData: Record<string, any> = {};

  if (!datatables || datatables.length === 0) {
    return datatableData;
  }

  try {
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return datatableData;
    }

    const fineractTenantId = await getFineractTenantId();

    // Fetch data for each datatable
    await Promise.all(
      datatables.map(async (dt: any) => {
        try {
          const response = await fetch(
            `${FINERACT_BASE_URL}/fineract-provider/api/v1/datatables/${encodeURIComponent(
              dt.registeredTableName
            )}/${clientId}?genericResultSet=true`,
            {
              method: "GET",
              headers: {
                Authorization: `Basic ${accessToken}`,
                "Fineract-Platform-TenantId": fineractTenantId,
                Accept: "application/json",
              },
              cache: "no-store",
            }
          );

          if (response.ok) {
            const data = await response.json();
            datatableData[dt.registeredTableName] = data;
          }
        } catch (err) {
          console.warn(
            `Failed to fetch data for ${dt.registeredTableName}:`,
            err
          );
        }
      })
    );
  } catch (error) {
    console.error("Error fetching datatable data:", error);
  }

  return datatableData;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const clientId = Number.parseInt(id);

  if (Number.isNaN(clientId)) {
    notFound();
  }

  // Fetch all data server-side in parallel
  const [client, clientImage, datatables] = await Promise.all([
    getClientData(clientId),
    getClientImage(clientId),
    getDatatables(),
  ]);

  // Fetch datatable data after we have the datatables list
  const datatableData = await getDatatableData(clientId, datatables || []);

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Breadcrumbs */}
      <ClientHeader
        clientId={clientId}
        client={client}
        clientImage={clientImage}
      />

      {/* Client Overview Cards */}
      <ClientDetails
        clientId={clientId}
        client={client}
        clientImage={clientImage}
      />

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger
            value="loans"
            className="flex items-center gap-2 px-2 md:px-3"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Loans</span>
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="flex items-center gap-2 px-2 md:px-3"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="flex items-center gap-2 px-2 md:px-3"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger
            value="additional-info"
            className="flex items-center gap-2 px-2 md:px-3"
          >
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Additional Info</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <ClientLoans clientId={clientId} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <ClientTransactions clientId={clientId} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <ClientDocuments clientId={clientId} />
        </TabsContent>

        {/* Additional Info Tab - Dynamic Datatables */}
        <TabsContent value="additional-info" className="space-y-4">
          <ClientAdditionalInfo
            clientId={clientId}
            datatables={datatables || []}
            datatableData={datatableData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
