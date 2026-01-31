using System;

namespace LegacyApp
{
    /// <summary>
    /// Quote calculation - Developer B. Same formula as PremiumPage/BillingModule but different names.
    /// Redundant constants and method for AI reviewer to catch when merged in PR.
    /// </summary>
    public partial class QuotePage
    {
        // Same values as TAX_RATE, AGE_LOADING_THRESHOLD elsewhere - redundant constants
        private const decimal QuoteTaxRate = 0.05m;
        private const int SeniorAgeThreshold = 60;
        private const decimal LoadingRate = 0.20m;

        /// <summary>
        /// Calculates quote amount with age loading and tax. Semantically same as CalculatePremium / GetBillingAmount.
        /// </summary>
        public decimal CalculateQuote(int age, decimal baseAmount)
        {
            decimal result = baseAmount;
            if (age >= SeniorAgeThreshold)  // Note: >= vs > in other modules - subtle logic drift
            {
                result = result + (baseAmount * LoadingRate);
            }
            result = result + (result * QuoteTaxRate);
            return result;
        }
    }
}
