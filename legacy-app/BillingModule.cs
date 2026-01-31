using System;

namespace LegacyApp
{
    /// <summary>
    /// Billing logic - Developer A. Redundant with PremiumPage/RenewalPage/QuotePage/ClaimsPage.
    /// Same age loading + tax formula; constants duplicated across modules.
    /// </summary>
    public static class BillingModule
    {
        // Redundant constants - same values as in PremiumPage, QuotePage, etc.
        public const decimal TAX_RATE = 0.05m;
        public const int AGE_LOADING_THRESHOLD = 60;
        public const decimal LOADING_PERCENT = 0.20m;

        /// <summary>
        /// Gets billing amount with age-based loading and tax. Same business logic as CalculatePremium / ComputeRenewalPremium.
        /// </summary>
        public static decimal GetBillingAmount(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age > AGE_LOADING_THRESHOLD)
            {
                amount += baseAmount * LOADING_PERCENT;
            }
            amount += amount * TAX_RATE;
            return amount;
        }
    }
}
