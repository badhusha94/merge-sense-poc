using System;

namespace LegacyApp
{
    /// <summary>
    /// Legacy discount rules. Intentionally overlaps with RenewalModule decisions.
    /// </summary>
    public class DiscountModule
    {
        private const int LoyaltyYearsThreshold = 5;
        private const decimal LoyaltyDiscountPercent = 0.10m;

        public decimal GetDiscountPercent(int loyaltyYears)
        {
            if (loyaltyYears >= LoyaltyYearsThreshold)
            {
                return LoyaltyDiscountPercent;
            }
            return 0m;
        }

        // Semantic duplicate: same rule with different naming.
        public decimal CalculateDiscountRate(int years)
        {
            if (years >= LoyaltyYearsThreshold)
            {
                return LoyaltyDiscountPercent;
            }
            return 0m;
        }

        public decimal ApplyDiscount(decimal amount, int loyaltyYears)
        {
            decimal rate = GetDiscountPercent(loyaltyYears);
            return amount - (amount * rate);
        }
    }
}

