"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  RefreshCw,
  MoreVertical,
  Eye,
  Pencil,
  Package2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoanProductListItem } from "@/shared/types/loan-product";

export default function LoanProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<LoanProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadProducts = async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const res = await fetch("/api/fineract/loanproducts");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to load loan products");
      setProducts(Array.isArray(body) ? body : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load loan products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.shortName.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products, search]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const paginatedProducts = useMemo(() => {
    const start = currentPage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, pageSize]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Loan Products</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage loan product configurations in Fineract.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadProducts} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button asChild>
            <Link href="/products/loan-products/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Loan Product
            </Link>
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Loan Products
          </CardTitle>
          <CardDescription>
            {products.length} product{products.length !== 1 ? "s" : ""} configured in Fineract
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {/* Search bar skeleton */}
              <Skeleton className="h-9 w-64 rounded-md" />

              {/* Table skeleton */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Repayments</TableHead>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead>Interest Type</TableHead>
                    <TableHead>Accounting</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Package2 className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No loan products found.</p>
              <Button asChild size="sm">
                <Link href="/products/loan-products/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first loan product
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-w-sm">
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Repayments</TableHead>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead>Interest Type</TableHead>
                    <TableHead>Accounting</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/products/loan-products/${product.id}`)
                      }
                    >
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.shortName}</Badge>
                      </TableCell>
                      <TableCell>
                        {product.currency?.displayLabel ||
                          product.currency?.code ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        {product.currency?.displaySymbol || ""}
                        {product.principal?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell>
                        {product.numberOfRepayments
                          ? `${product.numberOfRepayments} × every ${product.repaymentEvery} ${product.repaymentFrequencyType?.value ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {product.interestRatePerPeriod != null
                          ? `${product.interestRatePerPeriod}%`
                          : "—"}
                      </TableCell>
                      <TableCell>{product.interestType?.value ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.accountingRule?.id === 1 ? "secondary" : "default"
                          }
                        >
                          {product.accountingRule?.value ?? "—"}
                        </Badge>
                      </TableCell>

                      {/* Actions — stop propagation so row click doesn't fire */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/products/loan-products/${product.id}`}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/products/loan-products/${product.id}/edit`}
                                className="flex items-center gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filtered.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * pageSize + 1}-
                    {Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={String(pageSize)} />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 20, 30, 40, 50].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center text-sm font-medium">
                      Page {currentPage + 1} of {pageCount}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={currentPage === 0}
                      >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))
                        }
                        disabled={currentPage >= pageCount - 1}
                      >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {filtered.length === 0 && search && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No products match &quot;{search}&quot;
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
