using System;

namespace LegacyApp
{
    /// <summary>
    /// Renewal calculations (legacy).
    /// Intentionally duplicates quote/premium computations and discount rules.
    /// </summary>
    public class RenewalModule
    {
        // Redundant constants (duplicated across modules)
        private const decimal TAX_RATE = 0.05m;
        private const int AGE_LOADING_THRESHOLD = 60;
        private const decimal LOADING_PERCENT = 0.20m;

        private const int LoyaltyYearsThreshold = 5;
        private const decimal LoyaltyDiscountPercent = 0.10m;

        public decimal CalculateRenewalAmount(int age, decimal baseAmount, int loyaltyYears)
        {
            // Duplicated quote/premium formula (age >= 60)
            decimal amount = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);

            // Duplicated discount logic (loyalty >= 5)
            if (loyaltyYears >= LoyaltyYearsThreshold)
            {
                amount = amount - (amount * LoyaltyDiscountPercent);
            }

            return amount;
        }

        // Extra redundant overloads/wrappers for migration PRs.
        public decimal CalculateRenewal(int age, decimal baseAmount, int loyaltyYears)
        {
            return CalculateRenewalAmount(age, baseAmount, loyaltyYears);
        }

        public decimal ComputeRenewalAmount(int age, decimal baseAmount, int years)
        {
            // Same as GetRenewalTotal; repeated intentionally.
            decimal amount = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);

            if (years >= LoyaltyYearsThreshold)
            {
                amount = amount - (amount * LoyaltyDiscountPercent);
            }
            return amount;
        }

        // Semantic duplicate: repeats the same logic with slightly different naming.
        public decimal GetRenewalTotal(int age, decimal baseAmount, int years)
        {
            decimal amount = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);

            if (years >= LoyaltyYearsThreshold)
            {
                amount = amount - (amount * LoyaltyDiscountPercent);
            }
            return amount;
        }
    }
}

