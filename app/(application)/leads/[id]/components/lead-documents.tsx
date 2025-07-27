"use client";

import { useState } from "react";
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
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface LeadDocumentsProps {
  leadId: string;
}

export function LeadDocuments({ leadId }: LeadDocumentsProps) {
  // This would normally be fetched from an API
  const [documents, setDocuments] = useState([
    {
      id: "doc-1",
      name: "Business Registration Certificate",
      type: "PDF",
      size: "1.2 MB",
      uploadDate: "May 6, 2025",
      status: "verified",
      category: "Business Documents",
    },
    {
      id: "doc-2",
      name: "Financial Statements (2023-2024)",
      type: "PDF",
      size: "3.5 MB",
      uploadDate: "May 6, 2025",
      status: "verified",
      category: "Financial Documents",
    },
    {
      id: "doc-3",
      name: "Tax Returns (2023)",
      type: "PDF",
      size: "2.8 MB",
      uploadDate: "May 6, 2025",
      status: "verified",
      category: "Financial Documents",
    },
    {
      id: "doc-4",
      name: "Bank Statements (Last 6 months)",
      type: "PDF",
      size: "4.2 MB",
      uploadDate: "May 7, 2025",
      status: "verified",
      category: "Financial Documents",
    },
    {
      id: "doc-5",
      name: "Business Plan",
      type: "DOCX",
      size: "1.8 MB",
      uploadDate: "May 7, 2025",
      status: "pending",
      category: "Business Documents",
    },
    {
      id: "doc-6",
      name: "Equipment Quote",
      type: "PDF",
      size: "0.9 MB",
      uploadDate: "May 7, 2025",
      status: "verified",
      category: "Collateral Documents",
    },
  ]);

  // Group documents by category
  const documentsByCategory = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Lead Documents</CardTitle>
          <CardDescription>
            Documents submitted for this loan application
          </CardDescription>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(documentsByCategory).map(([category, docs]) => (
            <div key={category}>
              <h3 className="text-sm font-medium mb-3 text-foreground">
                {category}
              </h3>
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-3 mb-3 sm:mb-0">
                      <div className="rounded-md bg-blue-500/20 p-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {doc.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {doc.size}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {doc.uploadDate}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      {doc.status === "verified" ? (
                        <Badge
                          variant="outline"
                          className="border-green-500 bg-green-500/10 text-green-500 text-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-yellow-500 bg-yellow-500/10 text-yellow-500 text-xs"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Pending Verification
                        </Badge>
                      )}
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
