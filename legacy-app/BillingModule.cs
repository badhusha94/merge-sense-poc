using System;

namespace LegacyApp
{
    /// <summary>
    /// Billing calculation module (legacy).
    /// Intentionally duplicates QuoteModule/PremiumModule formula.
    /// </summary>
    public class BillingModule
    {
        public const decimal TAX_RATE = 0.05m;
        public const int AGE_LOADING_THRESHOLD = 60;
        public const decimal LOADING_PERCENT = 0.20m;

        public decimal GetBillingAmount(int age, decimal baseAmount)
        {
            decimal amount = baseAmount;
            if (age > AGE_LOADING_THRESHOLD)
            {
                amount = amount + (baseAmount * LOADING_PERCENT);
            }
            amount = amount + (amount * TAX_RATE);
            return amount;
        }

        // Redundant wrapper (semantic duplicate)
        public decimal CalculateInvoiceTotal(int age, decimal baseAmount)
        {
            return GetBillingAmount(age, baseAmount);
        }
    }
}

