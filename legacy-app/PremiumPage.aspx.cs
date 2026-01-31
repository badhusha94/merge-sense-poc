using System;
using System.Collections.Generic;

namespace LegacyApp
{
    public partial class PremiumPage
    {
        /// <summary>
        /// Calculates premium with age loading and tax.
        /// </summary>
        public decimal CalculatePremium(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age > 60)
            {
                amount += baseAmount * 0.20m; // 20% loading
            }
            amount += amount * 0.05m; // 5% tax
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
