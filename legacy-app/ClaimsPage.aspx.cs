using System;

namespace LegacyApp
{
    /// <summary>
    /// Claims calculation - Developer B. Same age loading + tax formula as Premium/Billing/Quote.
    /// Redundant method for semantic duplicate detection when migration PRs are merged.
    /// </summary>
    public partial class ClaimsPage
    {
        // Yet another copy of same constants
        private static readonly decimal ClaimTaxRate = 0.05m;
        private const int AgeLoadingCutoff = 60;
        private const decimal LoadingFactor = 0.20m;

        /// <summary>
        /// Calculates claim amount with age loading and tax. Same logic as CalculatePremium, GetBillingAmount, CalculateQuote.
        /// </summary>
        public decimal CalculateClaimAmount(int age, decimal baseAmount)
        {
            decimal claimAmount = baseAmount;
            if (age > AgeLoadingCutoff)
            {
                claimAmount += baseAmount * LoadingFactor;
            }
            claimAmount += claimAmount * ClaimTaxRate;
            return claimAmount;
        }
    }
}
