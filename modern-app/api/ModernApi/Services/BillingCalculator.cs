namespace ModernApi.Services;

/// <summary>
/// Billing calculator (migrated from legacy-app).
/// Consolidated to avoid semantic duplication within this module.
/// </summary>
public sealed class BillingCalculator
{
    public const decimal TAX_RATE = 0.05m;
    private const int AGE_LOADING_THRESHOLD = 60;
    private const decimal LOADING_PERCENT = 0.20m;

    public decimal CalculateBilling(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age > AGE_LOADING_THRESHOLD)
        {
            amount = amount + (baseAmount * LOADING_PERCENT);
        }

        amount = amount + (amount * TAX_RATE);
        return amount;
    }
}

