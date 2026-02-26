namespace ModernApi.Services;

/// <summary>
/// Quote calculation service (migrated from LegacyApp.QuoteModule).
/// </summary>
public class QuoteService
{
    private const decimal TaxRate = 0.05m;
    private const int AgeLoadingThreshold = 60;
    private const decimal LoadingPercent = 0.20m;

    public decimal CalculateQuote(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age >= AgeLoadingThreshold)
        {
            amount = amount + (baseAmount * LoadingPercent);
        }
        amount = amount + (amount * TaxRate);
        return amount;
    }
}

