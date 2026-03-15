"use client";

import useSWR from 'swr';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  AlertCircle,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FineractDocument {
  id: number;
  parentEntityType: string;
  parentEntityId: number;
  name: string;
  fileName: string;
  size: number;
  type: string;
  description?: string;
  location?: string;
  storageType: number;
  createdDate: string;
}

interface ClientDocumentsProps {
  clientId: number;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientDocuments({ clientId }: ClientDocumentsProps) {
  const { data, error, isLoading } = useSWR(`/api/fineract/clients/${clientId}/documents`, fetcher);

  // Handle different response formats
  const documents: FineractDocument[] = (() => {
    if (!data) return [];
    
    // If data is directly an array
    if (Array.isArray(data)) {
      return data;
    }
    
    // If data has pageItems (Fineract pagination format)
    if (data.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }
    
    // If data has content (another Fineract format)
    if (data.content && Array.isArray(data.content)) {
      return data.content;
    }
    
    // If data has documents property
    if (data.documents && Array.isArray(data.documents)) {
      return data.documents;
    }
    
    // Fallback to empty array
    return [];
  })();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (type.includes("image")) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getFileTypeBadge = (type: string) => {
    if (type.includes("pdf")) {
      return (
        <Badge variant="outline" className="bg-red-500 text-white border-0">
          PDF
        </Badge>
      );
    }
    if (type.includes("image")) {
      return (
        <Badge variant="outline" className="bg-blue-500 text-white border-0">
          Image
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-500 text-white border-0">
        Document
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client documents from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Client documents and attachments</CardDescription>
          </div>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No documents found for this client
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileTypeIcon(document.type)}
                        <div>
                          <div className="font-medium">{document.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {document.fileName}
                          </div>
                          {document.description && (
                            <div className="text-xs text-muted-foreground">
                              {document.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getFileTypeBadge(document.type)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatFileSize(document.size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(document.createdDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
