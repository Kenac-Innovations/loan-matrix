import { LeadContractViewer } from "./viewer";

interface LeadContractPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LeadContractPage({
  params,
}: LeadContractPageProps) {
  const { id } = await params;

  return <LeadContractViewer leadId={id} />;
}
