using System;

namespace LegacyApp
{
    /// <summary>
    /// Another premium calculator. Intentionally overlaps PremiumModule and QuoteModule.
    /// </summary>
    public class PremiumCalculator
    {
        private const decimal TaxRate = 0.05m;
        private const int AgeLoadingThreshold = 60;
        private const decimal LoadingPercent = 0.20m;

        // Drift: uses >= (different from PremiumModule which uses >).
        public decimal CalculatePremium(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age >= AgeLoadingThreshold)
            {
                amount += baseAmount * LoadingPercent;
            }
            amount += amount * TaxRate;
            return amount;
        }

        // Semantic duplicate wrapper.
        public decimal GetPremiumTotal(int age, decimal baseAmount)
        {
            return CalculatePremium(age, baseAmount);
        }
    }
}

