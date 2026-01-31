namespace ModernApi.Services;

/// <summary>
/// Discount service. Migrated from LegacyApp.DiscountHelper.
/// </summary>
public class DiscountService
{
    public const decimal DISCOUNT_THRESHOLD = 1000m;
    public const decimal DISCOUNT_PERCENT = 0.10m;

    public decimal ApplyDiscount(decimal amount)
    {
        if (amount <= DISCOUNT_THRESHOLD) return amount;
        return amount * (1m - DISCOUNT_PERCENT);
    }
}
