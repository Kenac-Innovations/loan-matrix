"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Database,
  RefreshCw,
  Activity,
  FileText,
  Users,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface IndexingStats {
  totalDocuments: number;
  documentsWithEmbeddings: number;
  documentsByType: Record<string, number>;
  lastIndexed: string | null;
  indexingProgress: number;
}

export default function RAGAdminPage() {
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch indexing statistics
  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch("/api/rag/index");
      if (!response.ok) {
        throw new Error("Failed to fetch indexing stats");
      }
      const data = await response.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching stats:", error);
      setError("Failed to load indexing statistics");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger manual indexing
  const triggerIndexing = async () => {
    try {
      setIsIndexing(true);
      setError(null);

      const response = await fetch("/api/rag/index", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to trigger indexing");
      }

      // Refresh stats after indexing
      await fetchStats();
    } catch (error) {
      console.error("Error triggering indexing:", error);
      setError("Failed to trigger indexing");
    } finally {
      setIsIndexing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case "client":
        return <Users className="h-4 w-4" />;
      case "loan":
        return <CreditCard className="h-4 w-4" />;
      case "loan_product":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case "client":
        return "Clients";
      case "loan":
        return "Loans";
      case "loan_product":
        return "Loan Products";
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RAG System Administration</h1>
          <p className="text-muted-foreground">
            Manage Fineract data indexing and RAG system configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={triggerIndexing}
            disabled={isIndexing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Database
              className={`h-4 w-4 mr-2 ${isIndexing ? "animate-spin" : ""}`}
            />
            {isIndexing ? "Indexing..." : "Index Now"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Documents
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.totalDocuments || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Indexed from Fineract
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  With Embeddings
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.documentsWithEmbeddings || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready for RAG queries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Last Updated
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading
                    ? "..."
                    : stats?.lastIndexed
                    ? new Date(stats.lastIndexed).toLocaleDateString()
                    : "Never"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.lastIndexed
                    ? new Date(stats.lastIndexed).toLocaleTimeString()
                    : "No data"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Indexing Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Indexing Progress
              </CardTitle>
              <CardDescription>
                Progress of document embedding generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Embedding Progress</span>
                  <span>{Math.round(stats?.indexingProgress || 0)}%</span>
                </div>
                <Progress
                  value={stats?.indexingProgress || 0}
                  className="h-2"
                />
              </div>

              {stats?.indexingProgress === 100 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">All documents have embeddings</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {(stats?.totalDocuments || 0) -
                      (stats?.documentsWithEmbeddings || 0)}{" "}
                    documents pending embedding
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Current status of RAG system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Fineract Connection
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    Connected
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm font-medium">OpenAI API</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Types</CardTitle>
              <CardDescription>
                Breakdown of indexed documents by type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.documentsByType &&
                  Object.entries(stats.documentsByType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getDocumentTypeIcon(type)}
                        <div>
                          <div className="font-medium">
                            {getDocumentTypeLabel(type)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {type} documents from Fineract
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}

                {(!stats?.documentsByType ||
                  Object.keys(stats.documentsByType).length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents indexed yet. Click "Index Now" to start.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                RAG system configuration and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Embedding Model</label>
                  <div className="p-2 border rounded bg-muted text-sm">
                    text-embedding-ada-002
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Similarity Threshold
                  </label>
                  <div className="p-2 border rounded bg-muted text-sm">0.7</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Results</label>
                  <div className="p-2 border rounded bg-muted text-sm">5</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Auto-Index Interval
                  </label>
                  <div className="p-2 border rounded bg-muted text-sm">
                    6 hours
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configuration changes require system restart to take effect.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <div className="text-center text-sm text-muted-foreground">
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
