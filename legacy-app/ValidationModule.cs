using System;

namespace LegacyApp
{
    /// <summary>
    /// Legacy validation module. Duplicates rules from other modules intentionally.
    /// </summary>
    public class ValidationModule
    {
        private const int MinAge = 18;
        private const int MaxAge = 100;

        public bool ValidateAge(int age)
        {
            return age >= MinAge && age <= MaxAge;
        }

        // Redundant semantic duplicate
        public bool IsValidAge(int age)
        {
            return age >= MinAge && age <= MaxAge;
        }

        public bool ValidateAmount(decimal amount)
        {
            return amount > 0;
        }

        // Redundant semantic duplicate
        public bool IsAmountValid(decimal amount)
        {
            return amount > 0;
        }
    }
}

