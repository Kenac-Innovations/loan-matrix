import { StatementView } from "./statement-view";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LoanStatementPage({ params }: PageProps) {
  const { id } = await params;
  const loanId = parseInt(id, 10);

  if (isNaN(loanId)) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <StatementView loanId={id} />
    </div>
  );
}
