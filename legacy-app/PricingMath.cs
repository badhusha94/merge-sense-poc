using System;

namespace LegacyApp
{
    /// <summary>
    /// Math helpers for pricing. Duplicates logic embedded in modules intentionally.
    /// </summary>
    public static class PricingMath
    {
        public static decimal AddAgeLoading(int age, decimal baseAmount)
        {
            if (age >= Constants.AgeLoadingThreshold)
            {
                return baseAmount + (baseAmount * Constants.LoadingPercent);
            }
            return baseAmount;
        }

        // Semantic duplicate with slightly different naming.
        public static decimal ApplySeniorLoading(int age, decimal amount)
        {
            if (age >= Constants.AgeLoadingThreshold)
            {
                return amount + (amount * Constants.LoadingPercent);
            }
            return amount;
        }

        public static decimal AddTax(decimal amount)
        {
            return amount + (amount * Constants.TaxRate);
        }

        // Duplicate of AddTax (redundant).
        public static decimal ApplyTax(decimal amount)
        {
            return amount + (amount * Constants.TaxRate);
        }
    }
}

