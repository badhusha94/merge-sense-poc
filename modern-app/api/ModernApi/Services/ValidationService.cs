namespace ModernApi.Services;

/// <summary>
/// Validation service (migrated from LegacyApp.ValidationModule / ClaimValidationModule).
/// Intentionally contains redundant logic for semantic-duplication PR review demos.
/// </summary>
public class ValidationService
{
    private const int MinAge = 18;
    private const int MaxAge = 100;

    private const int MinimumAge = 18;
    private const int MaximumAge = 100;

    public bool ValidateAge(int age)
    {
        return age >= MinAge && age <= MaxAge;
    }

    // Redundant semantic duplicate
    public bool IsValidAge(int age)
    {
        return age >= MinAge && age <= MaxAge;
    }

    // Another intentional duplicate (same rule, different const names)
    public bool IsAgeValid(int age)
    {
        return age >= MinimumAge && age <= MaximumAge;
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

