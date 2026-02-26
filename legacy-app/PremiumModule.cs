using System;

namespace LegacyApp
{
    /// <summary>
    /// Premium calculation module (legacy).
    /// Intentionally similar to QuoteModule and BillingModule.
    /// </summary>
    public class PremiumModule
    {
        // Redundant constants (duplicated across modules)
        private const decimal TaxRate = 0.05m;
        private const int AgeLoadingThreshold = 60;
        private const decimal LoadingPercent = 0.20m;

        // Subtle drift: uses > instead of >= (intentionally).
        public decimal CalculatePremium(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age > AgeLoadingThreshold)
            {
                amount = amount + (baseAmount * LoadingPercent);
            }
            amount = amount + (amount * TaxRate);
            return amount;
        }

        // Another semantic duplicate
        public decimal ComputePremiumTotal(int age, decimal baseAmount)
        {
            decimal result = baseAmount;
            if (age > AgeLoadingThreshold)
            {
                result = result + (baseAmount * LoadingPercent);
            }
            result = result + (result * TaxRate);
            return result;
        }
    }
}

