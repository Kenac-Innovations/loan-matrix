import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(request: NextRequest) {
  try {
    const fineractService = await getFineractServiceWithSession();
    const { searchParams } = new URL(request.url);
    const reportName = searchParams.get("reportName");
    const action = searchParams.get("action");

    // If action is 'list', return available reports
    if (action === "list") {
      try {
        const reports = await fineractService.getReports();
        // Handle both array and object responses from Fineract
        const reportsArray = Array.isArray(reports)
          ? reports
          : (reports as any)?.data || [];
        return NextResponse.json(reportsArray);
      } catch (error: any) {
        console.error("Error fetching reports list:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch reports list",
            details: error.response?.data || error.message,
          },
          { status: error.response?.status || 500 }
        );
      }
    }

    // If action is 'parameters', return report parameters
    if (action === "parameters" && reportName) {
      try {
        const parameters = await fineractService.getReportParameters(
          reportName
        );
        return NextResponse.json(parameters);
      } catch (error: any) {
        console.error("Error fetching report parameters:", {
          reportName,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch report parameters",
            details: error.response?.data || error.message,
          },
          { status: error.response?.status || 500 }
        );
      }
    }

    // If action is 'parameterOptions', return parameter options
    if (action === "parameterOptions") {
      const parameterName = searchParams.get("parameterName");
      if (!parameterName) {
        return NextResponse.json(
          { error: "Missing parameterName parameter" },
          { status: 400 }
        );
      }
      // Extract parent/dependent params (e.g. officeId for loanOfficerIdSelectAll)
      const optionParams: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (
          key !== "parameterName" &&
          key !== "action" &&
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          optionParams[key] = value;
        }
      });
      try {
        const options = await fineractService.getParameterOptions(
          parameterName,
          optionParams
        );
        return NextResponse.json(options);
      } catch (error: any) {
        console.error("Error fetching parameter options:", {
          parameterName,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch parameter options",
            details: error.response?.data || error.message,
          },
          { status: error.response?.status || 500 }
        );
      }
    }

    // If reportName is provided, run the specific report
    if (reportName) {
      // Extract all parameters except reportName and action
      const reportParams: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (key !== "reportName" && key !== "action" && value) {
          reportParams[key] = value;
        }
      });

      try {
        const reportData = await fineractService.runReport(
          reportName,
          reportParams
        );
        return NextResponse.json(reportData);
      } catch (error: any) {
        console.error("Error running report:", {
          reportName,
          parameters: reportParams,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        return NextResponse.json(
          {
            error: "Failed to run report",
            details: error.response?.data || error.message,
          },
          { status: error.response?.status || 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Missing reportName parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching Fineract report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch report data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
