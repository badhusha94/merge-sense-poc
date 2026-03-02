using System.Text;
using ModernApi.Models;

namespace ModernApi.Services;

/// <summary>
/// Produces CSV and HTML outputs for debit note data.
/// </summary>
public class DebitNoteReportGenerator
{
    public byte[] GenerateCsvBytes(IEnumerable<DebitNote> entries)
    {
        var buffer = new StringBuilder();
        buffer.AppendLine("DebitNoteId,ReferenceNumber,ClientName,OriginalInvoiceAmount,AdjustmentRate,DebitValue,State,GeneratedOn,Remarks");

        foreach (var entry in entries)
        {
            string client = entry.ClientName ?? "";
            if (client.Contains(',')) client = $"\"{client}\"";

            string remarks = entry.Remarks ?? "";
            if (remarks.Contains(',')) remarks = $"\"{remarks}\"";

            buffer.Append(entry.DebitNoteId);
            buffer.Append(',');
            buffer.Append(entry.ReferenceNumber);
            buffer.Append(',');
            buffer.Append(client);
            buffer.Append(',');
            buffer.Append(entry.OriginalInvoiceAmount.ToString("F2"));
            buffer.Append(',');
            buffer.Append((entry.AdjustmentRate * 100).ToString("F1"));
            buffer.Append("%,");
            buffer.Append(entry.DebitValue.ToString("F2"));
            buffer.Append(',');
            buffer.Append(entry.State);
            buffer.Append(',');
            buffer.Append(entry.GeneratedOn.ToString("yyyy-MM-dd HH:mm:ss"));
            buffer.Append(',');
            buffer.AppendLine(remarks);
        }

        return Encoding.UTF8.GetBytes(buffer.ToString());
    }

    public string GenerateHtmlDocument(IEnumerable<DebitNote> entries)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html><head>");
        sb.AppendLine("<title>Debit Notes Report</title>");
        sb.AppendLine("<style>");
        sb.AppendLine("body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 2rem; }");
        sb.AppendLine("h1 { color: #1a1a2e; }");
        sb.AppendLine("table { border-collapse: collapse; width: 100%; margin-top: 1rem; }");
        sb.AppendLine("th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }");
        sb.AppendLine("th { background-color: #16213e; color: #fff; }");
        sb.AppendLine("tr:nth-child(even) { background-color: #f0f0f0; }");
        sb.AppendLine(".summary { font-weight: bold; font-size: 1.15em; margin-top: 1.5rem; }");
        sb.AppendLine(".note { color: #888; font-size: 0.8em; margin-top: 2rem; }");
        sb.AppendLine("</style>");
        sb.AppendLine("</head><body>");
        sb.AppendLine("<h1>Debit Notes Report</h1>");
        sb.AppendLine($"<p>Report generated: {DateTimeOffset.UtcNow:dd/MM/yyyy HH:mm:ss}</p>");

        sb.AppendLine("<table>");
        sb.AppendLine("<thead><tr>");
        sb.AppendLine("<th>Reference</th>");
        sb.AppendLine("<th>Client</th>");
        sb.AppendLine("<th>Original Amount</th>");
        sb.AppendLine("<th>Adj. Rate</th>");
        sb.AppendLine("<th>Debit Value</th>");
        sb.AppendLine("<th>State</th>");
        sb.AppendLine("<th>Generated</th>");
        sb.AppendLine("<th>Remarks</th>");
        sb.AppendLine("</tr></thead>");
        sb.AppendLine("<tbody>");

        decimal cumulativeTotal = 0m;
        int rowCount = 0;

        foreach (var entry in entries)
        {
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td>{entry.ReferenceNumber}</td>");
            sb.AppendLine($"<td>{entry.ClientName}</td>");
            sb.AppendLine($"<td>{entry.OriginalInvoiceAmount:C}</td>");
            sb.AppendLine($"<td>{entry.AdjustmentRate * 100:F1}%</td>");
            sb.AppendLine($"<td>{entry.DebitValue:C}</td>");
            sb.AppendLine($"<td>{entry.State}</td>");
            sb.AppendLine($"<td>{entry.GeneratedOn:dd/MM/yyyy}</td>");
            sb.AppendLine($"<td>{entry.Remarks ?? ""}</td>");
            sb.AppendLine("</tr>");

            cumulativeTotal += entry.DebitValue;
            rowCount++;
        }

        sb.AppendLine("</tbody>");
        sb.AppendLine("</table>");

        sb.AppendLine($"<div class='summary'>Total Debit Notes: {rowCount}</div>");
        sb.AppendLine($"<div class='summary'>Cumulative Total: {cumulativeTotal:C}</div>");
        sb.AppendLine("<div class='note'>Use Ctrl+P to print this page as PDF.</div>");

        sb.AppendLine("</body></html>");

        return sb.ToString();
    }
}
