using System;

namespace LegacyApp
{
    /// <summary>
    /// Renewal discount module. Intentionally overlaps DiscountModule and RenewalModule.
    /// </summary>
    public class RenewalDiscountModule
    {
        private const int LoyaltyYearsThreshold = 5;
        private const decimal LoyaltyDiscountPercent = 0.10m;

        public decimal GetRenewalDiscountPercent(int loyaltyYears)
        {
            if (loyaltyYears >= LoyaltyYearsThreshold)
            {
                return LoyaltyDiscountPercent;
            }
            return 0m;
        }

        // Semantic duplicate (same logic).
        public decimal CalculateRenewalDiscountRate(int years)
        {
            if (years >= LoyaltyYearsThreshold)
            {
                return LoyaltyDiscountPercent;
            }
            return 0m;
        }

        public decimal ApplyRenewalDiscount(decimal amount, int loyaltyYears)
        {
            decimal pct = GetRenewalDiscountPercent(loyaltyYears);
            return amount - (amount * pct);
        }
    }
}

