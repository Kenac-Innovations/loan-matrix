import ExcelJS from 'exceljs';
import type { InventoryReportResult } from './inventory-report-types';
export async function exportInventoryReport(report:InventoryReportResult,format:'csv'|'xlsx'):Promise<Uint8Array>{
 if(report.totalRows>50000||report.rows.length!==report.totalRows)throw new Error('Export requires the complete filtered result, limited to 50,000 rows. Narrow the filters.');
 if(format==='csv'){
 const cell=(s:string)=>'"'+s.replaceAll('"','""')+'"';
 const safe=(s:string)=>/^[\s]*[=+@-]/.test(s)?"'"+s:s;
 const lines=[report.columns.map(c=>cell(c.key)).join(','),...report.rows.map(r=>report.columns.map(c=>cell(c.type==='text'?safe(r[c.key]??''):(r[c.key]??''))).join(','))];
 return new TextEncoder().encode('\uFEFF'+lines.join('\r\n'));
 }
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Inventory Report');
 sheet.addRow(report.columns.map(c=>c.key));sheet.getRow(1).font={bold:true};
 for(const row of report.rows)sheet.addRow(report.columns.map(c=>row[c.key]??''));
 sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,report.rows.length+1),column:report.columns.length}};
 sheet.columns.forEach(c=>{c.width=24});
 const info=workbook.addWorksheet('Report Information');info.addRows([['Generated',report.generatedAt],['Position',report.positionBasis],['Timezone',report.timezone]]);
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}
