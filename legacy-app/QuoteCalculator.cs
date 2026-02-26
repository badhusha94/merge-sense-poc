using System;

namespace LegacyApp
{
    /// <summary>
    /// Another quote calculator class that overlaps QuoteModule intentionally.
    /// </summary>
    public class QuoteCalculator
    {
        // Redundant constants (duplicate again; should be Constants.*)
        private const decimal TAX_RATE = 0.05m;
        private const int AGE_LOADING_THRESHOLD = 60;
        private const decimal LOADING_PERCENT = 0.20m;

        public decimal Calculate(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);
            return amount;
        }

        // Duplicate using helper methods (still same business logic).
        public decimal CalculateUsingHelpers(int age, decimal baseAmount)
        {
            decimal amount = PricingMath.AddAgeLoading(age, baseAmount);
            amount = PricingMath.AddTax(amount);
            return amount;
        }
    }
}

