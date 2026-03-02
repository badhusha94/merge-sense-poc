namespace ModernApi.Services;

/// <summary>
/// Renewal calculations (migrated from legacy).
/// Consolidated to avoid semantic duplication within this module.
/// </summary>
public class RenewalModule
{
    // Redundant constants (duplicated across modules)
    private const decimal TAX_RATE = 0.05m;
    private const int AGE_LOADING_THRESHOLD = 60;
    private const decimal LOADING_PERCENT = 0.20m;

    private const int LoyaltyYearsThreshold = 5;
    private const decimal LoyaltyDiscountPercent = 0.10m;

    public decimal CalculateRenewalAmount(int age, decimal baseAmount, int loyaltyYears)
    {
        decimal amount = baseAmount;
        if (age >= AGE_LOADING_THRESHOLD)
        {
            amount = amount + (baseAmount * LOADING_PERCENT);
        }
        amount = amount + (amount * TAX_RATE);

        if (loyaltyYears >= LoyaltyYearsThreshold)
        {
            amount = amount - (amount * LoyaltyDiscountPercent);
        }

        return amount;
    }
}

