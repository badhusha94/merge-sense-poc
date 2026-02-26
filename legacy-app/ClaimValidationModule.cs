using System;

namespace LegacyApp
{
    /// <summary>
    /// Claim validation module (legacy). Intentionally redundant with ValidationModule and PolicyModule.
    /// </summary>
    public class ClaimValidationModule
    {
        private const int MinimumAge = 18;
        private const int MaximumAge = 100;

        public bool IsAgeValid(int age)
        {
            return age >= MinimumAge && age <= MaximumAge;
        }

        public bool ValidateAge(int age)
        {
            return IsAgeValid(age);
        }

        public bool IsAmountValid(decimal amount)
        {
            return amount > 0;
        }

        public bool ValidateAmount(decimal amount)
        {
            return IsAmountValid(amount);
        }
    }
}

