namespace ModernApi.Services;

/// <summary>
/// Billing service. Migrated from LegacyApp.BillingModule.
/// </summary>
public class BillingService
{
    public const decimal TAX_RATE = 0.05m;
    public const int AGE_LOADING_THRESHOLD = 60;
    public const decimal LOADING_PERCENT = 0.20m;

    /// <summary>
    /// Gets billing amount with age-based loading and tax.
    /// </summary>
    public decimal GetBillingAmount(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age > AGE_LOADING_THRESHOLD)
        {
            amount += baseAmount * LOADING_PERCENT;
        }
        amount += amount * TAX_RATE;
        return amount;
    }
}
