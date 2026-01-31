using System;

namespace LegacyApp
{
    /// <summary>
    /// Discount logic - Developer A. Apply 10% discount when amount exceeds threshold.
    /// Redundant with PolicyPage.ApplyPolicyDiscount and RenewalDiscountHelper.
    /// </summary>
    public static class DiscountHelper
    {
        public const decimal DISCOUNT_THRESHOLD = 1000m;
        public const decimal DISCOUNT_PERCENT = 0.10m;

        public static decimal ApplyDiscount(decimal amount)
        {
            if (amount <= DISCOUNT_THRESHOLD) return amount;
            return amount * (1m - DISCOUNT_PERCENT);
        }
    }
}
