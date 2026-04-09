import {
  User,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Building,
  Hash,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  displayName: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  mobileNo?: string;
  emailAddress?: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  activationDate?: string | number[];
  officeName: string;
  officeId?: number;
  timeline: {
    submittedOnDate: string | number[];
    activatedOnDate?: string | number[];
  };
  dateOfBirth?: string | number[];
  gender?: {
    id: number;
    name: string;
  };
  clientClassification?: {
    id: number;
    name: string;
  };
  clientType?: {
    id: number;
    name: string;
  };
  legalForm?: {
    id: number;
    code: string;
    value: string;
  };
  clientNonPersonDetails?: {
    incorporationDate?: string | number[];
  };
}

interface ClientDetailsProps {
  client: FineractClient | null;
  clientImage: string | null;
}

export function ClientDetails({
  client,
  clientImage,
}: ClientDetailsProps) {
  const getStatusBadge = (
    status: FineractClient["status"],
    active: boolean
  ) => {
    if (active && status.code === "clientStatusType.active") {
      return (
        <Badge variant="outline" className="bg-green-500 text-white border-0">
          Active
        </Badge>
      );
    }
    if (status.code === "clientStatusType.pending") {
      return (
        <Badge variant="outline" className="bg-yellow-500 text-white border-0">
          Pending
        </Badge>
      );
    }
    if (status.code === "clientStatusType.closed") {
      return (
        <Badge variant="outline" className="bg-gray-500 text-white border-0">
          Closed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500 text-white border-0">
        {status.value}
      </Badge>
    );
  };

  const formatDate = (dateInput: string | number[] | undefined) => {
    if (!dateInput) return "Not specified";

    let date: Date;
    if (Array.isArray(dateInput) && dateInput.length === 3) {
      const [year, month, day] = dateInput;
      date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    } else if (typeof dateInput === "string") {
      date = new Date(dateInput);
    } else {
      return "Invalid date";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!client) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client details from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={clientImage || undefined}
                alt={client.displayName}
              />
              <AvatarFallback className="text-lg">
                {client.firstname?.[0] || ""}
                {client.lastname?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{client.displayName}</h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(client.status, client.active)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Client ID:</span> {client.id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Account No:</span>{" "}
                {client.accountNo}
              </span>
            </div>
            {client.externalId && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">External ID:</span>{" "}
                  <span className="font-mono">{client.externalId}</span>
                </span>
              </div>
            )}
            {client.gender && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Gender:</span>{" "}
                  {client.gender.name}
                </span>
              </div>
            )}
            {(client.dateOfBirth || client.clientNonPersonDetails?.incorporationDate) && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">
                    {client.legalForm?.value?.toLowerCase() === "entity"
                      ? "Date of Incorporation:"
                      : "Date of Birth:"}
                  </span>{" "}
                  {formatDate(
                    client.legalForm?.value?.toLowerCase() === "entity"
                      ? client.clientNonPersonDetails?.incorporationDate ??
                          client.dateOfBirth
                      : client.dateOfBirth
                  )}
                </span>
              </div>
            )}
            {client.clientType && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Client Type:</span>{" "}
                  {client.clientType.name}
                </span>
              </div>
            )}
            {client.clientClassification && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Classification:</span>{" "}
                  {client.clientClassification.name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {client.mobileNo && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{client.mobileNo}</span>
            </div>
          )}
          {client.emailAddress && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{client.emailAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">Office:</span> {client.officeName}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Account Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Account Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Submitted</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(client.timeline.submittedOnDate)}
              </p>
            </div>
            {client.timeline.activatedOnDate && (
              <div>
                <p className="text-sm font-medium">Activated</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(client.timeline.activatedOnDate)}
                </p>
              </div>
            )}
            {client.activationDate && (
              <div>
                <p className="text-sm font-medium">Current Status Since</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(client.activationDate)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
