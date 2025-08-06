"use client";

import useSWR from 'swr';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  DollarSign,
  AlertCircle,
  Building,
  Hash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FineractClient {
  id: number;
  accountNo: string;
  displayName: string;
  firstname: string;
  lastname: string;
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
  timeline: {
    submittedOnDate: string | number[];
    activatedOnDate?: string | number[];
  };
  dateOfBirth?: string | number[];
  gender?: {
    id: number;
    name: string;
  };
}

interface ClientDetailsProps {
  clientId: number;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientDetails({ clientId }: ClientDetailsProps) {
  const { data, error, isLoading } = useSWR(`/api/fineract/clients/${clientId}`, fetcher);

  // Handle different response formats
  const client: FineractClient | null = (() => {
    if (!data) return null;
    
    // If data has a client property (our wrapper)
    if (data.client) {
      return data.client;
    }
    
    // If data is directly the client object
    if (data.id && data.accountNo) {
      return data;
    }
    
    // Fallback to null
    return null;
  })();

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

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !client) {
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
                src={`/api/placeholder/64/64?text=${client.firstname[0]}${client.lastname[0]}`}
                alt={client.displayName}
              />
              <AvatarFallback className="text-lg">
                {client.firstname[0]}
                {client.lastname[0]}
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
            {client.gender && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Gender:</span>{" "}
                  {client.gender.name}
                </span>
              </div>
            )}
            {client.dateOfBirth && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Date of Birth:</span>{" "}
                  {formatDate(client.dateOfBirth)}
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
