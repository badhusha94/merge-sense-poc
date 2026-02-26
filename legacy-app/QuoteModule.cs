using System;

namespace LegacyApp
{
    /// <summary>
    /// Quote calculation module (legacy).
    /// Duplicates logic found in PremiumModule/BillingModule/RenewalModule intentionally.
    /// </summary>
    public class QuoteModule
    {
        // Redundant constants (duplicated across modules)
        private const decimal TAX_RATE = 0.05m;
        private const int AGE_LOADING_THRESHOLD = 60;
        private const decimal LOADING_PERCENT = 0.20m;

        public decimal CalculateQuote(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);
            return amount;
        }

        // Semantic duplicate: same business logic with different naming.
        public decimal GetQuoteAmount(int age, decimal baseAmount)
        {
            decimal total = baseAmount;
            if (age >= AGE_LOADING_THRESHOLD)
            {
                total = total + (baseAmount * LOADING_PERCENT);
            }
            total = total + (total * TAX_RATE);
            return total;
        }

        // Redundant helper (unused in some paths; exists to be flagged).
        public bool IsSenior(int age)
        {
            return age >= AGE_LOADING_THRESHOLD;
        }
    }
}

