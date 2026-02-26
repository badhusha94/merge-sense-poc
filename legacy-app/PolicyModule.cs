using System;

namespace LegacyApp
{
    /// <summary>
    /// Policy module with redundant validation and duplicated discount checks.
    /// </summary>
    public class PolicyModule
    {
        private const int MinAge = 18;
        private const int MaxAge = 100;

        public bool IsEligibleForPolicy(int age, decimal baseAmount)
        {
            // Duplicates ValidationModule rules.
            if (age < MinAge || age > MaxAge) return false;
            if (baseAmount <= 0) return false;
            return true;
        }

        // Semantic duplicate for the same eligibility logic.
        public bool ValidateEligibility(int age, decimal baseAmount)
        {
            if (age < MinAge || age > MaxAge) return false;
            if (baseAmount <= 0) return false;
            return true;
        }

        public decimal ApplyLoyaltyDiscount(decimal amount, int loyaltyYears)
        {
            // Duplicates DiscountModule logic.
            if (loyaltyYears >= Constants.LoyaltyYearsThreshold)
            {
                return amount - (amount * Constants.LoyaltyDiscountPercent);
            }
            return amount;
        }
    }
}

