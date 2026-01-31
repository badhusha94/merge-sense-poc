using System;
using System.Collections.Generic;

namespace LegacyApp
{
    public partial class PremiumPage
    {
        // Redundant constants - same values in BillingModule, QuotePage, ClaimsPage
        private const decimal TaxRate = 0.05m;
        private const int AgeLoadingThreshold = 60;
        private const decimal LoadingPercent = 0.20m;

        /// <summary>
        /// Calculates premium with age loading and tax.
        /// </summary>
        public decimal CalculatePremium(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age > AgeLoadingThreshold)
            {
                amount += baseAmount * LoadingPercent;
            }
            amount += amount * TaxRate;
            return amount;
        }

        /// <summary>
        /// Dummy export to Excel.
        /// </summary>
        public void ExportToExcel(List<string> data)
        {
            // Dummy implementation - not used for semantic comparison
            if (data == null) return;
            foreach (var item in data)
            {
                // Would write to Excel here
            }
        }
    }
}
