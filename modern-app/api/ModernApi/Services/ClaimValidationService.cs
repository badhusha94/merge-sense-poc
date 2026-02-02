namespace ModernApi.Services;

/// <summary>
/// Claim validation service. Migrated from LegacyApp.ClaimValidation.
/// </summary>
public class ClaimValidationService
{
    private const int MinimumAge = 18;
    private const int MaximumAge = 100;

    // Compatibility aliases for controller naming (older code expected these method names).
    public bool IsAgeValid(int age)
    {
        return IsValidAge(age);
    }

    public bool IsAmountValid(decimal amount)
    {
        return IsValidAmount(amount);
    }

    public bool IsValidAge(int age)
    {
        return age >= MinimumAge && age <= MaximumAge;
    }

    public bool IsValidAmount(decimal amount)
    {
        return amount > 0;
    }

    public bool ValidateAmount(decimal amount)
    {
        return IsValidAmount(amount);
    }

    public bool ValidateAge(int age)
    {
        return IsValidAge(age);
    }

    public bool IsValidAmountUsingExistingLogic(decimal amount)
    {
        return ValidateAmount(amount);
    }

    public bool ValidateAgeUsingExistingLogic(int age)
    {
        return IsValidAge(age);
    }
}