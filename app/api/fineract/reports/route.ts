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
      const reports = await fineractService.getReports();
      return NextResponse.json(reports);
    }

    // If action is 'parameters', return report parameters
    if (action === "parameters" && reportName) {
      const parameters = await fineractService.getReportParameters(reportName);
      return NextResponse.json(parameters);
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
      const options = await fineractService.getParameterOptions(parameterName);
      return NextResponse.json(options);
    }

    // If reportName is provided, run the specific report
    if (reportName) {
      // Extract all parameters except reportName and action
      const parameters: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (key !== "reportName" && key !== "action" && value) {
          parameters[key] = value;
        }
      });

      const reportData = await fineractService.runReport(
        reportName,
        parameters
      );
      return NextResponse.json(reportData);
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
