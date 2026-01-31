using System;

namespace LegacyApp
{
    /// <summary>
    /// Validation utilities - Developer A. Same rules duplicated in PolicyPage and ClaimValidation.
    /// Redundant methods/variables for PR review to catch when two branches add similar validation.
    /// </summary>
    public static class ValidationHelper
    {
        public const int MinAge = 18;
        public const int MaxAge = 100;

        public static bool ValidateAge(int age)
        {
            return age >= MinAge && age <= MaxAge;
        }

        public static bool ValidateAmount(decimal amount)
        {
            return amount > 0;
        }
    }
}
