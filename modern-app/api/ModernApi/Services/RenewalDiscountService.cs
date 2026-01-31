namespace ModernApi.Services;

/// <summary>
/// Renewal discount service. Migrated from LegacyApp.RenewalDiscountHelper.
/// </summary>
public class RenewalDiscountService
{
    private const decimal RenewalDiscountThreshold = 1000m;
    private const decimal RenewalDiscountPercent = 0.10m;

    public decimal ApplyRenewalDiscount(decimal amount)
    {
        if (amount <= RenewalDiscountThreshold) return amount;
        return amount * (1m - RenewalDiscountPercent);
    }
}
