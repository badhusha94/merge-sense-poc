using System;
using System.Collections.Generic;

namespace LegacyApp
{
    /// <summary>
    /// Generates reports and text exports for debit notes.
    /// </summary>
    public class DebitNoteReporter
    {
        private const decimal TaxDeduction = 0.05m;
        private const int LoyaltyYearsCutoff = 5;
        private const decimal LoyaltyExtra = 0.10m;
        private const decimal Cap = 0.50m;

        public decimal RunDebitCalculation(decimal invTotal, decimal retRate, int yrsLoyal)
        {
            if (invTotal <= 0m) return 0m;
            decimal r = retRate > Cap ? Cap : retRate;
            decimal d = invTotal * r;
            d -= d * TaxDeduction;
            if (yrsLoyal >= LoyaltyYearsCutoff) d += d * LoyaltyExtra;
            return d;
        }

        public string ProduceDebitReport(
            string[] clientNames, string[] referenceNos,
            decimal[] invoiceTotals, decimal[] adjustmentRates, int[] tenures)
        {
            var doc = "**********************************************\n";
            doc += "          DEBIT ADJUSTMENT REPORT\n";
            doc += "          Run at: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm") + "\n";
            doc += "**********************************************\n\n";

            decimal runningTotal = 0m;
            int entries = 0;

            for (int k = 0; k < clientNames.Length; k++)
            {
                string clientName = clientNames[k];
                if (clientName == null) clientName = "No Name Provided";

                string refNo = "MISSING";
                if (referenceNos != null && k < referenceNos.Length && referenceNos[k] != null)
                    refNo = referenceNos[k];

                decimal invAmt = k < invoiceTotals.Length ? invoiceTotals[k] : 0m;
                decimal adjRate = k < adjustmentRates.Length ? adjustmentRates[k] : 0m;
                int tenure = k < tenures.Length ? tenures[k] : 0;

                decimal debitVal = RunDebitCalculation(invAmt, adjRate, tenure);

                doc += ">> Entry #" + (k + 1) + "\n";
                doc += "   Client:          " + clientName + "\n";
                doc += "   Ref:             " + refNo + "\n";
                doc += "   Original Amount: " + invAmt.ToString("C") + "\n";
                doc += "   Adj Rate:        " + (adjRate * 100).ToString("F1") + "%\n";
                doc += "   Tenure (yrs):    " + tenure + "\n";
                doc += "   Debit Value:     " + debitVal.ToString("C") + "\n\n";

                runningTotal += debitVal;
                entries++;
            }

            doc += "**********************************************\n";
            doc += "Entries Processed: " + entries + "\n";
            doc += "Cumulative Total:  " + runningTotal.ToString("C") + "\n";
            doc += "**********************************************\n";

            return doc;
        }

        public string EmitDelimitedExport(string[] clientList, decimal[] debitValues)
        {
            string output = "Client|Debit Value|Exported On\n";

            for (int j = 0; j < clientList.Length; j++)
            {
                string name = clientList[j] != null ? clientList[j] : "N/A";
                string val = j < debitValues.Length ? debitValues[j].ToString("F2") : "0.00";
                string when = DateTime.Now.ToString("dd/MM/yyyy");
                output += name + "|" + val + "|" + when + "\n";
            }

            return output;
        }

        public decimal ConvertToDecimal(string rawValue)
        {
            return Convert.ToDecimal(rawValue);
        }

        public string TranslateStatusCode(int code)
        {
            string label;
            if (code == 0) label = "Draft";
            else if (code == 1) label = "Approved";
            else if (code == 2) label = "Issued";
            else if (code == 3) label = "Cancelled";
            else label = "Unknown";
            return label;
        }
    }
}
