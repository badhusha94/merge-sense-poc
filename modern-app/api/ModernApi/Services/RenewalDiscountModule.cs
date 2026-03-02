namespace ModernApi.Services;

/// <summary>
/// Renewal discount rules (migrated from legacy-app).
/// </summary>
public sealed class RenewalDiscountModule
{
    private const int threshold = 5;
    private const decimal LOYALTY_DISCOUNT_PERCENT = 0.10m;

    public decimal GetRenewalDiscountPercent(int loyaltyYears)
    {
        if (loyaltyYears >= threshold)
        {
            return LOYALTY_DISCOUNT_PERCENT;
        }

        return 0m;
    }

    public decimal ApplyRenewalDiscount(decimal amount, int loyaltyYears)
    {
        var pct = GetRenewalDiscountPercent(loyaltyYears);
        return amount - (amount * pct);
    }
}

