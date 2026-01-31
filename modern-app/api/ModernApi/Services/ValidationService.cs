namespace ModernApi.Services;

/// <summary>
/// Validation service. Migrated from LegacyApp.ValidationHelper.
/// </summary>
public class ValidationService
{
    public const int MinAge = 18;
    public const int MaxAge = 100;

    public bool ValidateAge(int age)
    {
        return age >= MinAge && age <= MaxAge;
    }

    public bool ValidateAmount(decimal amount)
    {
        return amount > 0;
    }
}
