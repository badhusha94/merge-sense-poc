namespace ModernApi.Services;

/// <summary>
/// Premium calculation service. Migrated from LegacyApp.PremiumPage.
/// </summary>
public class PremiumService
{
    private const decimal TaxRate = 0.05m;
    private const int AgeLoadingThreshold = 60;
    private const decimal LoadingPercent = 0.20m;

    /// <summary>
    /// Calculates premium with age loading and tax.
    /// </summary>
    public decimal CalculatePremium(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age > AgeLoadingThreshold)
        {
            amount += baseAmount * LoadingPercent;
        }
        amount += amount * TaxRate;
        return amount;
    }
}
