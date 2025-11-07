"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DynamicDatatableContentProps {
  datatableName: string;
  clientId: number;
}

export function DynamicDatatableContent({ datatableName, clientId }: DynamicDatatableContentProps) {
  const [headers, setHeaders] = useState<any[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/fineract/datatables/${encodeURIComponent(datatableName)}/${clientId}?genericResultSet=true`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to fetch datatable rows");
        setHeaders(data.columnHeaders || []);
        const mapped: any[][] = (data.data || []).map((r: any) => r.row);
        setRows(mapped);
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datatableName, clientId]);

  const formatCell = (val: any) => {
    if (Array.isArray(val)) {
      // Date or DateTime arrays from Fineract
      const [y, m, d, hh, mm, ss] = val;
      if (y && m && d) {
        const dt = new Date(y, (m as number) - 1, d as number, hh || 0, mm || 0, ss || 0);
        return dt.toLocaleString();
      }
      return JSON.stringify(val);
    }
    if (val === true) return "Yes";
    if (val === false) return "No";
    if (val === null || val === undefined) return "";
    return String(val);
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h: any) => (
              <TableHead key={h.columnName} className="whitespace-nowrap">{h.columnName}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="text-center">No data</TableCell>
            </TableRow>
          ) : (
            rows.map((row, ri) => (
              <TableRow key={ri}>
                {row.map((cell: any, ci: number) => (
                  <TableCell key={`${ri}-${ci}`} className="whitespace-nowrap">{formatCell(cell)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}


