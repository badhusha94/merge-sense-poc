namespace ModernApi.Services;

/// <summary>
/// Policy service. Migrated from LegacyApp.PolicyPage.
/// </summary>
public class PolicyService
{
    private const decimal PolicyDiscountThreshold = 1000m;
    private const decimal PolicyDiscountRate = 0.10m;

    public decimal ApplyPolicyDiscount(decimal amount)
    {
        if (amount <= PolicyDiscountThreshold) return amount;
        return amount * (1m - PolicyDiscountRate);
    }

    public bool ValidateAge(int age)
    {
        return age >= 18 && age <= 100;
    }

    public bool ValidateAmount(decimal amount)
    {
        return amount > 0;
    }
}
