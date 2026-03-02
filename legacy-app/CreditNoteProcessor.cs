using System;
using System.Collections.Generic;

namespace LegacyApp
{
    /// <summary>
    /// Credit note processing and reporting (legacy).
    /// Intentionally duplicates calculation logic from CreditNoteModule and CreditNoteCalculator.
    /// </summary>
    public class CreditNoteProcessor
    {
        private const decimal TAX_RATE = 0.05m;
        private const int LOYALTY_THRESHOLD = 5;
        private const decimal LOYALTY_DISCOUNT = 0.10m;
        private const decimal MAX_CREDIT_PERCENT = 0.50m;

        // Semantic duplicate: repeats the same calculation from CreditNoteModule.
        public decimal ProcessCreditNote(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)
        {
            if (invoiceAmount <= 0)
            {
                return 0m;
            }

            decimal pct = returnPercent;
            if (pct > MAX_CREDIT_PERCENT)
            {
                pct = MAX_CREDIT_PERCENT;
            }

            decimal amount = invoiceAmount * pct;

            decimal taxDeduction = amount * TAX_RATE;
            amount = amount - taxDeduction;

            if (loyaltyYears >= LOYALTY_THRESHOLD)
            {
                decimal loyaltyBonus = amount * LOYALTY_DISCOUNT;
                amount = amount + loyaltyBonus;
            }

            return amount;
        }

        public string GenerateCreditNoteReport(List<string> customerNames, List<string> invoiceNumbers,
            List<decimal> invoiceAmounts, List<decimal> returnPercents, List<int> loyaltyYearsList)
        {
            string report = "";
            report = report + "==========================================\n";
            report = report + "        CREDIT NOTE REPORT\n";
            report = report + "        Generated: " + DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss") + "\n";
            report = report + "==========================================\n\n";

            decimal grandTotal = 0;
            int processedCount = 0;

            for (int i = 0; i < customerNames.Count; i++)
            {
                string name = customerNames[i];
                if (name == null)
                {
                    name = "Unknown Customer";
                }

                string invNum = "N/A";
                if (invoiceNumbers != null && i < invoiceNumbers.Count)
                {
                    if (invoiceNumbers[i] != null)
                    {
                        invNum = invoiceNumbers[i];
                    }
                }

                decimal invAmount = 0;
                if (i < invoiceAmounts.Count)
                {
                    invAmount = invoiceAmounts[i];
                }

                decimal retPct = 0;
                if (i < returnPercents.Count)
                {
                    retPct = returnPercents[i];
                }

                int loyalty = 0;
                if (i < loyaltyYearsList.Count)
                {
                    loyalty = loyaltyYearsList[i];
                }

                decimal creditAmount = ProcessCreditNote(invAmount, retPct, loyalty);

                report = report + "--- Item " + (i + 1).ToString() + " ---\n";
                report = report + "Customer:       " + name + "\n";
                report = report + "Invoice:        " + invNum + "\n";
                report = report + "Invoice Amount: " + invAmount.ToString("C") + "\n";
                report = report + "Return %:       " + (retPct * 100).ToString("F1") + "%\n";
                report = report + "Loyalty Years:  " + loyalty.ToString() + "\n";
                report = report + "Credit Amount:  " + creditAmount.ToString("C") + "\n";
                report = report + "\n";

                grandTotal = grandTotal + creditAmount;
                processedCount = processedCount + 1;
            }

            report = report + "==========================================\n";
            report = report + "Total Credit Notes: " + processedCount.ToString() + "\n";
            report = report + "Grand Total:        " + grandTotal.ToString("C") + "\n";
            report = report + "==========================================\n";

            return report;
        }

        public string ExportToText(List<string> customers, List<decimal> amounts)
        {
            string header = "Customer Name" + "," + "Credit Amount" + "," + "Export Date" + "\n";
            string body = "";

            for (int i = 0; i < customers.Count; i++)
            {
                string custName = "";
                if (customers[i] != null)
                {
                    custName = customers[i];
                }
                else
                {
                    custName = "N/A";
                }

                string amountStr = "0.00";
                if (i < amounts.Count)
                {
                    amountStr = amounts[i].ToString("F2");
                }

                string dateStr = DateTime.Now.ToString("dd/MM/yyyy");

                body = body + custName + "," + amountStr + "," + dateStr + "\n";
            }

            return header + body;
        }

        public decimal ParseCreditAmount(string amountText)
        {
            decimal result = Convert.ToDecimal(amountText);
            return result;
        }

        public string GetStatusLabel(int statusCode)
        {
            if (statusCode == 0)
            {
                return "Draft";
            }
            else if (statusCode == 1)
            {
                return "Approved";
            }
            else if (statusCode == 2)
            {
                return "Issued";
            }
            else if (statusCode == 3)
            {
                return "Cancelled";
            }
            else
            {
                return "Unknown";
            }
        }
    }
}
