import { notFound } from "next/navigation";
import { hasPermissionServer } from "@/lib/authorization";
import { SpecificPermission } from "@/shared/types/auth";
import { ClientServicingStatusesClient } from "../components/client-servicing-statuses-client";

export default async function ClientServicingStatusesPage() {
  const canConfigure = await hasPermissionServer(
    SpecificPermission.UPDATE_CLIENT_SERVICING_STATUS_POLICY
  );

  if (!canConfigure) {
    notFound();
  }

  return <ClientServicingStatusesClient />;
}
