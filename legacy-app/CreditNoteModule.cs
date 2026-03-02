using System;
using System.Collections.Generic;

namespace LegacyApp
{
    /// <summary>
    /// Credit note calculation module (legacy).
    /// Intentionally overlaps with CreditNoteCalculator and CreditNoteProcessor.
    /// </summary>
    public class CreditNoteModule
    {
        private const decimal TAX_RATE = 0.05m;
        private const int LOYALTY_THRESHOLD = 5;
        private const decimal LOYALTY_DISCOUNT = 0.10m;
        private const decimal MAX_CREDIT_PERCENT = 0.50m;

        public decimal CalculateCreditAmount(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)
        {
            if (invoiceAmount <= 0)
            {
                return 0m;
            }

            decimal effectiveReturn = returnPercent;
            if (effectiveReturn > MAX_CREDIT_PERCENT)
            {
                effectiveReturn = MAX_CREDIT_PERCENT;
            }

            decimal creditBase = invoiceAmount * effectiveReturn;

            decimal taxAdjustment = creditBase * TAX_RATE;
            creditBase = creditBase - taxAdjustment;

            if (loyaltyYears >= LOYALTY_THRESHOLD)
            {
                decimal loyaltyBonus = creditBase * LOYALTY_DISCOUNT;
                creditBase = creditBase + loyaltyBonus;
            }

            return creditBase;
        }

        // Semantic duplicate: same rule with different variable names.
        public decimal GetCreditNoteTotal(decimal invAmount, decimal retPercent, int years)
        {
            if (invAmount <= 0)
            {
                return 0m;
            }

            decimal pct = retPercent;
            if (pct > MAX_CREDIT_PERCENT)
            {
                pct = MAX_CREDIT_PERCENT;
            }

            decimal baseCredit = invAmount * pct;

            decimal tax = baseCredit * TAX_RATE;
            baseCredit = baseCredit - tax;

            if (years >= LOYALTY_THRESHOLD)
            {
                decimal bonus = baseCredit * LOYALTY_DISCOUNT;
                baseCredit = baseCredit + bonus;
            }

            return baseCredit;
        }

        public decimal ApplyCreditToInvoice(decimal invoiceAmount, decimal creditAmount)
        {
            if (creditAmount < 0)
            {
                creditAmount = 0;
            }
            decimal result = invoiceAmount - creditAmount;
            if (result < 0)
            {
                result = 0;
            }
            return result;
        }

        public string FormatCreditNote(string customerName, string invoiceNumber, decimal creditAmount)
        {
            if (customerName == null)
            {
                customerName = "Unknown";
            }
            if (invoiceNumber == null)
            {
                invoiceNumber = "N/A";
            }

            string output = "CREDIT NOTE" + "\n";
            output = output + "Customer: " + customerName + "\n";
            output = output + "Invoice: " + invoiceNumber + "\n";
            output = output + "Amount: " + creditAmount.ToString("F2") + "\n";
            output = output + "Date: " + DateTime.Now.ToString("dd/MM/yyyy") + "\n";

            return output;
        }

        public List<string> GetCreditNoteSummaries(List<decimal> amounts, List<string> customers)
        {
            List<string> summaries = new List<string>();
            for (int i = 0; i < amounts.Count; i++)
            {
                string customer = "Unknown";
                if (customers != null && i < customers.Count && customers[i] != null)
                {
                    customer = customers[i];
                }
                string line = customer + " - " + amounts[i].ToString("C");
                summaries.Add(line);
            }
            return summaries;
        }
    }
}
