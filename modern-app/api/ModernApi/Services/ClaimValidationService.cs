namespace ModernApi.Services;

/// <summary>
/// Claim validation service. Migrated from LegacyApp.ClaimValidation.
/// </summary>
public class ClaimValidationService
{
    private const int MinimumAge = 18;
    private const int MaximumAge = 100;

    public bool IsValidAge(int age)
    {
        return age >= MinimumAge && age <= MaximumAge;
    }

    public bool IsValidAmount(decimal amount)
    {
        return amount > 0;
    }

    public bool IsValidAgeUsingExistingLogic(int age)
    {
        return IsValidAge(age);
    }

    public bool IsValidAmountUsingExistingLogic(decimal amount)
    {
        return IsValidAmount(amount);
    }
}