using System;

namespace LegacyApp
{
    /// <summary>
    /// Policy page - Developer B. Duplicates discount logic (DiscountHelper) and validation (ValidationHelper).
    /// When two branches migrate PolicyPage vs DiscountHelper/ValidationHelper, PR will show duplication.
    /// </summary>
    public partial class PolicyPage
    {
        // Same as DiscountHelper - redundant constants
        private const decimal PolicyDiscountThreshold = 1000m;
        private const decimal PolicyDiscountRate = 0.10m;

        /// <summary>
        /// Same business rule as DiscountHelper.ApplyDiscount: 10% off above 1000.
        /// </summary>
        public decimal ApplyPolicyDiscount(decimal amount)
        {
            if (amount <= PolicyDiscountThreshold) return amount;
            return amount * (1m - PolicyDiscountRate);
        }

        /// <summary>
        /// Validates age 18-100. Duplicate of ValidationHelper.ValidateAge.
        /// </summary>
        public bool ValidateAge(int age)
        {
            return age >= 18 && age <= 100;
        }

        /// <summary>
        /// Validates amount > 0. Duplicate of ValidationHelper.ValidateAmount.
        /// </summary>
        public bool ValidateAmount(decimal amount)
        {
            return amount > 0;
        }
    }
}
