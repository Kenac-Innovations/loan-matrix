import Link from "next/link";
import { ArrowLeft, Edit, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  displayName: string;
  firstname?: string;
  lastname?: string;
  mobileNo?: string;
  emailAddress?: string;
  status?: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  officeName?: string;
  clientType?: {
    id: number;
    name: string;
  };
}

interface ClientHeaderProps {
  clientId: number;
  client: FineractClient | null;
  clientImage: string | null;
}

export function ClientHeader({
  clientId,
  client,
  clientImage,
}: ClientHeaderProps) {
  const getStatusBadgeColor = (status: string | null, active: boolean) => {
    if (active) return "bg-green-500";
    if (status === "clientStatusType.pending") return "bg-yellow-500";
    if (status === "clientStatusType.closed") return "bg-gray-500";
    return "bg-blue-500";
  };

  if (!client) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href="/clients"
            className="hover:text-foreground transition-colors"
          >
            Clients
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground font-medium">
            Client #{clientId}
          </span>
        </nav>
        <div className="flex items-center gap-6">
          <Link href="/clients">
            <Button variant="outline" size="sm" className="shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Client Details
            </h1>
            <p className="text-muted-foreground">
              Unable to load client information
            </p>
          </div>
        </div>
      </div>
    );
  }

  const initials = `${client.firstname?.[0] || ""}${
    client.lastname?.[0] || ""
  }`;

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link
          href="/clients"
          className="hover:text-foreground transition-colors"
        >
          Clients
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground font-medium">
          {client.displayName}
        </span>
      </nav>

      {/* Enhanced Header */}
      <div className="flex items-center gap-6">
        <Link href="/clients">
          <Button variant="outline" size="sm" className="shadow-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={clientImage || undefined}
                  alt={client.displayName}
                />
                <AvatarFallback className="text-lg bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
                  {initials || <Users className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {client.displayName}
                  </h1>
                  <Badge
                    className={`${getStatusBadgeColor(
                      client.status?.code || null,
                      client.active
                    )} text-white border-0`}
                  >
                    {client.active
                      ? "Active"
                      : client.status?.value || "Unknown"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  <span className="mr-3">
                    Account:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {client.accountNo}
                    </span>
                  </span>
                  {client.externalId && (
                    <span className="mr-3">
                      External ID:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {client.externalId}
                      </span>
                    </span>
                  )}
                  {client.officeName && (
                    <span className="mr-3">
                      Office:{" "}
                      <span className="font-medium text-foreground">
                        {client.officeName}
                      </span>
                    </span>
                  )}
                  {client.clientType?.name && (
                    <span>
                      Type:{" "}
                      <span className="font-medium text-foreground">
                        {client.clientType.name}
                      </span>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link href={`/clients/${clientId}/edit`}>
              <Button size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Client
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
