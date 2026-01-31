using System;

namespace LegacyApp
{
    /// <summary>
    /// Claim validation - Developer B. Same age/amount rules as ValidationHelper and PolicyPage.
    /// Redundant methods for PR review when two branches add similar validation services.
    /// </summary>
    public static class ClaimValidation
    {
        private const int MinimumAge = 18;
        private const int MaximumAge = 100;

        public static bool IsValidAge(int age)
        {
            return age >= MinimumAge && age <= MaximumAge;
        }

        public static bool IsValidAmount(decimal amount)
        {
            return amount > 0;
        }
    }
}
