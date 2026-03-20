"use server";

import { revalidatePath } from "next/cache";

export interface ExportData {
  [key: string]: any;
}

export interface ExportColumn {
  id: string;
  header: string;
  accessorKey?: string;
}

/**
 * Server action to generate CSV content for export
 */
export async function generateCSVExport(
  data: ExportData[],
  columns: ExportColumn[],
  filename: string
): Promise<{ success: boolean; csvContent?: string; error?: string }> {
  try {
    if (!data || data.length === 0) {
      return { success: false, error: "No data to export" };
    }

    // Generate headers
    const headers = columns.map(col => col.header).join(",");
    
    // Generate rows
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.accessorKey ? item[col.accessorKey] : "";
        if (value === null || value === undefined) return "";
        
        // Handle complex objects
        let stringValue: string;
        if (typeof value === 'object' && value !== null) {
          stringValue = (value as any).value || (value as any).code || (value as any).name || String(value);
        } else {
          stringValue = String(value);
        } 

        
        
        // Escape CSV special characters
        return stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(",")
    );

    const csvContent = `${headers}\n${rows.join("\n")}`;
    
    return { success: true, csvContent };
  } catch (error) {
    console.error("CSV export error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to generate CSV export" 
    };
  }
}

/**
 * Server action to generate a downloadable CSV file
 */
export async function downloadCSVExport(
  data: ExportData[],
  columns: ExportColumn[],
  filename: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    const result = await generateCSVExport(data, columns, filename);
    
    if (!result.success || !result.csvContent) {
      return { success: false, error: result.error };
    }
    
    const timestamp = new Date().toISOString().split("T")[0];
    const fullFilename = `${filename}-${timestamp}.csv`;
    
    // Production-ready options:
    
    // Option 1: Stream response directly (recommended for small-medium files)
    // return { success: true, downloadUrl: `/api/export/csv/${fullFilename}` };
    
    // Option 2: Upload to cloud storage (AWS S3, Google Cloud, etc.)
    // const uploadResult = await uploadToCloudStorage(result.csvContent, fullFilename);
    // return { success: true, downloadUrl: uploadResult.signedUrl };
    
    // Option 3: Save to temporary directory and return file path
    // const tempPath = await saveToTempFile(result.csvContent, fullFilename);
    // return { success: true, downloadUrl: `/downloads/${fullFilename}` };
    
    // Option 4: Database storage with cleanup job
    // const fileId = await storeFileInDatabase(result.csvContent, fullFilename);
    // return { success: true, downloadUrl: `/api/files/${fileId}` };
    
    // Current implementation: data URL for immediate download
    return { 
      success: true, 
      downloadUrl: `data:text/csv;charset=utf-8,${encodeURIComponent(result.csvContent)}` 
    };
  } catch (error) {
    console.error("CSV download error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to generate CSV download" 
    };
  }
}

/**
 * Server action to export data with server-side filtering and pagination
 */
export async function exportFilteredData(
  data: ExportData[],
  columns: ExportColumn[],
  filename: string,
  filters?: {
    search?: string;
    columnFilters?: Record<string, any>;
  }
): Promise<{ success: boolean; csvContent?: string; error?: string; count?: number }> {
  try {
    let filteredData = data;

    // Apply server-side filtering
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredData = filteredData.filter(item =>
        columns.some(col => {
          const value = col.accessorKey ? item[col.accessorKey] : "";
          if (value === null || value === undefined) return false;
          
          let stringValue: string;
          if (typeof value === 'object' && value !== null) {
            stringValue = (value as any).value || (value as any).code || (value as any).name || String(value);
          } else {
            stringValue = String(value);
          }
          
          return stringValue.toLowerCase().includes(searchTerm);
        })
      );
    }

    // Apply column-specific filters
    if (filters?.columnFilters) {
      filteredData = filteredData.filter(item =>
        Object.entries(filters.columnFilters!).every(([columnId, filterValue]) => {
          if (!filterValue || filterValue === "" || filterValue === "all") return true;
          
          const column = columns.find(col => col.id === columnId);
          if (!column || !column.accessorKey) return true;
          
          const itemValue = item[column.accessorKey];
          if (itemValue === null || itemValue === undefined) return false;
          
          if (typeof itemValue === 'object' && itemValue !== null) {
            const objValue = itemValue as any;
            return objValue.value === filterValue || 
                   objValue.code === filterValue ||
                   objValue.id === filterValue ||
                   String(itemValue) === filterValue;
          }
          
          return String(itemValue) === filterValue;
        })
      );
    }

    const result = await generateCSVExport(filteredData, columns, filename);
    
    return {
      ...result,
      count: filteredData.length
    };
  } catch (error) {
    console.error("Filtered export error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to export filtered data" 
    };
  }
}

/**
 * Production-ready server action for streaming CSV exports
 * Use this in an API route for large datasets
 */
export async function streamCSVExport(
  data: ExportData[],
  columns: ExportColumn[],
  filename: string
): Promise<{ success: boolean; stream?: ReadableStream; error?: string }> {
  try {
    if (!data || data.length === 0) {
      return { success: false, error: "No data to export" };
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const fullFilename = `${filename}-${timestamp}.csv`;
    
    // Create streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Send headers first
        const headers = columns.map(col => col.header).join(",");
        controller.enqueue(encoder.encode(headers + "\n"));
        
        // Stream data in chunks
        let index = 0;
        const chunkSize = 100; // Process 100 rows at a time
        
        const processChunk = () => {
          const chunk = data.slice(index, index + chunkSize);
          
          if (chunk.length === 0) {
            controller.close();
            return;
          }
          
          const rows = chunk.map(item =>
            columns.map(col => {
              const value = col.accessorKey ? item[col.accessorKey] : "";
              if (value === null || value === undefined) return "";
              
              let stringValue: string;
              if (typeof value === 'object' && value !== null) {
                stringValue = (value as any).value || (value as any).code || (value as any).name || String(value);
              } else {
                stringValue = String(value);
              }
              
              return stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")
                ? `"${stringValue.replace(/"/g, '""')}"`
                : stringValue;
            }).join(",")
          );
          
          const csvChunk = rows.join("\n") + (index + chunkSize < data.length ? "\n" : "");
          controller.enqueue(encoder.encode(csvChunk));
          
          index += chunkSize;
          
          // Use setTimeout to avoid blocking the event loop
          setTimeout(processChunk, 0);
        };
        
        processChunk();
      }
    });

    return { success: true, stream };
  } catch (error) {
    console.error("CSV stream error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to generate CSV stream" 
    };
  }
}
