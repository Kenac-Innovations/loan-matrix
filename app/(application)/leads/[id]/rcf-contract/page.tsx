import { RcfContractViewer } from "./viewer";

export default async function RcfContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leadId } = await params;
  return <RcfContractViewer leadId={leadId} />;
}
