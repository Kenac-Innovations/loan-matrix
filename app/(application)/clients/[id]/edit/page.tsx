import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientEditForm } from "./components/client-edit-form";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClientEditPage({ params }: PageProps) {
  const { id } = await params;
  const clientId = parseInt(id);

  if (isNaN(clientId)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/clients" className="hover:text-foreground">Clients</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground">Client #{clientId}</Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clients/${clientId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Client</h1>
          <p className="text-muted-foreground">
            Update client information and details
          </p>
        </div>
      </div>

      {/* Client Edit Form */}
      <Suspense fallback={<div>Loading client details...</div>}>
        <ClientEditForm clientId={clientId} />
      </Suspense>
    </div>
  );
} 