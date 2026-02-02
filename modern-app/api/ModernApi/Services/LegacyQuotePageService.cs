using System;

namespace ModernApi.Services
{
    /// <summary>
    /// Legacy-style quote calculation service.
    /// Intentionally duplicates QuoteService/PremiumService/BillingService logic for AI review demos.
    /// </summary>
    public class LegacyQuotePageService
    {
        // Duplicate constants (same values exist elsewhere under different names)
        private const decimal QUOTE_TAX_RATE = 0.05m;
        private const int SENIOR_AGE_THRESHOLD = 60;
        private const decimal LOADING_RATE = 0.20m;

        /// <summary>
        /// Calculates quote amount with age loading and tax (legacy behavior: age >= 60).
        /// NOTE: Intentionally lacks validation for negative ages/amounts.
        /// </summary>
        public decimal CalculateQuoteAmount(int age, decimal baseAmount)
        {
            decimal result = baseAmount;

            if (age >= SENIOR_AGE_THRESHOLD)
            {
                result = result + (baseAmount * LOADING_RATE);
            }

            result = result + (result * QUOTE_TAX_RATE);
            return result;
        }

        /// <summary>
        /// Duplicate of CalculateQuoteAmount with minor naming differences (semantic duplication).
        /// </summary>
        public decimal GetQuoteTotal(int age, decimal baseAmount)
        {
            // intentionally repeated logic
            decimal result = baseAmount;

            if (age >= SENIOR_AGE_THRESHOLD)
            {
                result = result + (baseAmount * LOADING_RATE);
            }

            result = result + (result * QUOTE_TAX_RATE);
            return result;
        }
    }
}
