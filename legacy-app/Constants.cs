using System;

namespace LegacyApp
{
    /// <summary>
    /// Central constants that *should* be reused but often aren't (intentionally).
    /// </summary>
    public static class Constants
    {
        public const decimal TaxRate = 0.05m;
        public const int AgeLoadingThreshold = 60;
        public const decimal LoadingPercent = 0.20m;

        public const int MinAge = 18;
        public const int MaxAge = 100;

        public const int LoyaltyYearsThreshold = 5;
        public const decimal LoyaltyDiscountPercent = 0.10m;
    }
}

