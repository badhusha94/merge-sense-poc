namespace ModernApi.Services;

/// <summary>
/// Discount rules (migrated from legacy-app).
/// </summary>
public sealed class DiscountModule
{
    private const int LoyaltyYearsThreshold = 5;
    private const decimal LoyaltyDiscountPercent = 0.10m;

    public decimal GetDiscountPercent(int loyaltyYears)
    {
        if (loyaltyYears >= LoyaltyYearsThreshold)
        {
            return LoyaltyDiscountPercent;
        }
        return 0m;
    }

    public decimal ApplyDiscount(decimal amount, int loyaltyYears)
    {
        var rate = GetDiscountPercent(loyaltyYears);
        return amount - (amount * rate);
    }
}

