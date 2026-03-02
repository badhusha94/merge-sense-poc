using System;
using System.Collections.Generic;

namespace LegacyApp
{
    /// <summary>
    /// Handles debit note generation and amount resolution for outstanding balances.
    /// </summary>
    public class DebitNoteHandler
    {
        private const decimal TaxFactor = 0.05m;
        private const int MinYearsForLoyaltyBenefit = 5;
        private const decimal LoyaltyBenefitRate = 0.10m;
        private const decimal UpperBoundPercent = 0.50m;

        public decimal ResolveDebitValue(decimal originalInvoice, decimal adjustmentRate, int customerTenure)
        {
            if (originalInvoice <= 0) return 0m;

            var rate = Math.Min(adjustmentRate, UpperBoundPercent);
            var rawDebit = originalInvoice * rate;
            rawDebit -= rawDebit * TaxFactor;

            if (customerTenure >= MinYearsForLoyaltyBenefit)
                rawDebit += rawDebit * LoyaltyBenefitRate;

            return rawDebit;
        }

        public decimal DeriveDebitNoteAmount(decimal billAmount, decimal pct, int tenureYears)
        {
            if (billAmount <= 0) return decimal.Zero;

            decimal cappedPct = pct > UpperBoundPercent ? UpperBoundPercent : pct;
            decimal debit = billAmount * cappedPct;
            decimal afterTax = debit - (debit * TaxFactor);
            decimal finalAmount = tenureYears >= MinYearsForLoyaltyBenefit
                ? afterTax + (afterTax * LoyaltyBenefitRate)
                : afterTax;

            return finalAmount;
        }

        public decimal SubtractDebitFromBalance(decimal outstandingBalance, decimal debitValue)
        {
            var adjusted = outstandingBalance - Math.Max(debitValue, 0m);
            return adjusted < 0 ? 0m : adjusted;
        }

        public string RenderDebitNotice(string client, string refNumber, decimal value)
        {
            var c = client ?? "Unspecified";
            var r = refNumber ?? "—";
            return string.Join("\n", new[]
            {
                "DEBIT NOTE",
                "Client: " + c,
                "Reference: " + r,
                "Value: " + value.ToString("F2"),
                "Issued: " + DateTime.Now.ToString("dd/MM/yyyy")
            });
        }

        public List<string> BuildDebitSummaryLines(List<decimal> values, List<string> clients)
        {
            var lines = new List<string>();
            int count = values.Count;
            for (int idx = 0; idx < count; idx++)
            {
                var who = (clients != null && idx < clients.Count && clients[idx] != null)
                    ? clients[idx]
                    : "Unspecified";
                lines.Add(who + " — " + values[idx].ToString("C"));
            }
            return lines;
        }
    }
}
