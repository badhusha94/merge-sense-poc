using System.Text;
using ModernApi.Models;

namespace ModernApi.Services;

/// <summary>
/// Handles credit note exports to CSV and HTML.
/// Migrated from legacy CreditNoteProcessor — still carries some outdated patterns.
/// </summary>
public class CreditNoteExportService
{
    public byte[] ExportToCsv(IEnumerable<CreditNote> notes)
    {
        string csv = "";
        csv = csv + "Id,InvoiceNumber,CustomerName,InvoiceAmount,ReturnPercent,CreditAmount,Status,CreatedAt,Notes\n";

        List<CreditNote> noteList = new List<CreditNote>();
        foreach (var n in notes)
        {
            noteList.Add(n);
        }

        for (int i = 0; i < noteList.Count; i++)
        {
            CreditNote note = noteList[i];

            string customerName = note.CustomerName;
            if (customerName == null)
            {
                customerName = "";
            }
            if (customerName.Contains(","))
            {
                customerName = "\"" + customerName + "\"";
            }

            string notesField = note.Notes;
            if (notesField == null)
            {
                notesField = "";
            }
            if (notesField.Contains(","))
            {
                notesField = "\"" + notesField + "\"";
            }

            csv = csv + note.Id.ToString() + ","
                + note.InvoiceNumber + ","
                + customerName + ","
                + note.InvoiceAmount.ToString("F2") + ","
                + (note.ReturnPercent * 100).ToString("F1") + "%,"
                + note.CreditAmount.ToString("F2") + ","
                + note.Status.ToString() + ","
                + note.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss") + ","
                + notesField + "\n";
        }

        byte[] bytes = Encoding.UTF8.GetBytes(csv);
        return bytes;
    }

    public string ExportToHtml(IEnumerable<CreditNote> notes)
    {
        string html = "";
        html = html + "<!DOCTYPE html>\n";
        html = html + "<html><head>\n";
        html = html + "<title>Credit Notes Report</title>\n";
        html = html + "<style>\n";
        html = html + "body { font-family: Arial, sans-serif; margin: 2rem; }\n";
        html = html + "h1 { color: #333; }\n";
        html = html + "table { border-collapse: collapse; width: 100%; }\n";
        html = html + "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n";
        html = html + "th { background-color: #4472C4; color: white; }\n";
        html = html + "tr:nth-child(even) { background-color: #f2f2f2; }\n";
        html = html + ".total { font-weight: bold; font-size: 1.2em; margin-top: 1rem; }\n";
        html = html + ".footer { color: #666; font-size: 0.85em; margin-top: 2rem; }\n";
        html = html + "</style>\n";
        html = html + "</head><body>\n";
        html = html + "<h1>Credit Notes Report</h1>\n";
        html = html + "<p>Generated: " + DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss") + "</p>\n";

        html = html + "<table>\n";
        html = html + "<thead><tr>\n";
        html = html + "<th>Invoice #</th>\n";
        html = html + "<th>Customer</th>\n";
        html = html + "<th>Invoice Amount</th>\n";
        html = html + "<th>Return %</th>\n";
        html = html + "<th>Credit Amount</th>\n";
        html = html + "<th>Status</th>\n";
        html = html + "<th>Created</th>\n";
        html = html + "<th>Notes</th>\n";
        html = html + "</tr></thead>\n";
        html = html + "<tbody>\n";

        decimal grandTotal = 0;
        int count = 0;

        List<CreditNote> noteList = new List<CreditNote>();
        foreach (var n in notes)
        {
            noteList.Add(n);
        }

        for (int i = 0; i < noteList.Count; i++)
        {
            CreditNote note = noteList[i];

            html = html + "<tr>\n";
            html = html + "<td>" + note.InvoiceNumber + "</td>\n";
            html = html + "<td>" + note.CustomerName + "</td>\n";
            html = html + "<td>" + note.InvoiceAmount.ToString("C") + "</td>\n";
            html = html + "<td>" + (note.ReturnPercent * 100).ToString("F1") + "%</td>\n";
            html = html + "<td>" + note.CreditAmount.ToString("C") + "</td>\n";
            html = html + "<td>" + note.Status.ToString() + "</td>\n";
            html = html + "<td>" + note.CreatedAt.ToString("dd/MM/yyyy") + "</td>\n";

            string notesText = note.Notes;
            if (notesText == null)
            {
                notesText = "";
            }
            html = html + "<td>" + notesText + "</td>\n";
            html = html + "</tr>\n";

            grandTotal = grandTotal + note.CreditAmount;
            count = count + 1;
        }

        html = html + "</tbody>\n";
        html = html + "</table>\n";

        html = html + "<div class='total'>Total Credit Notes: " + count.ToString() + "</div>\n";
        html = html + "<div class='total'>Grand Total: " + grandTotal.ToString("C") + "</div>\n";
        html = html + "<div class='footer'>This report can be printed to PDF using your browser's print function (Ctrl+P).</div>\n";

        html = html + "</body></html>\n";

        return html;
    }
}
