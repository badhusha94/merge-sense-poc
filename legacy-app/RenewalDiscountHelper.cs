using System;

namespace LegacyApp
{
    /// <summary>
    /// Renewal discount - Developer B. Same 10% above 1000 rule as DiscountHelper and PolicyPage.ApplyPolicyDiscount.
    /// Redundant for semantic duplicate detection when both branches migrate to modern-app.
    /// </summary>
    public static class RenewalDiscountHelper
    {
        private const decimal RenewalDiscountThreshold = 1000m;
        private const decimal RenewalDiscountPercent = 0.10m;

        public static decimal ApplyRenewalDiscount(decimal amount)
        {
            if (amount <= RenewalDiscountThreshold) return amount;
            return amount * (1m - RenewalDiscountPercent);
        }
    }
}
