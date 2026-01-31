using System;
using System.Collections.Generic;

namespace LegacyApp
{
    public partial class RenewalPage
    {
        // Redundant constants - same as PremiumPage, BillingModule, QuotePage
        private const decimal RenewalTaxRate = 0.05m;
        private const int SeniorThreshold = 60;
        private const decimal LoadingRate = 0.20m;

        /// <summary>
        /// Computes renewal premium with age loading and tax.
        /// Same business intent as CalculatePremium but written differently (age >= 60 vs > 60).
        /// </summary>
        public decimal ComputeRenewalPremium(int age, decimal baseAmount)
        {
            decimal result = baseAmount;
            if (age >= SeniorThreshold)
            {
                result = result + (baseAmount * LoadingRate);
            }
            result = result + (result * RenewalTaxRate);
            return result;
        }
    }
}
