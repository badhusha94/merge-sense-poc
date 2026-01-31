namespace ModernApi.Services;

/// <summary>
/// Quote service. Migrated from LegacyApp.QuotePage.
/// </summary>
public class QuoteService
{
    private const decimal QuoteTaxRate = 0.05m;
    private const int SeniorAgeThreshold = 60;
    private const decimal LoadingRate = 0.20m;

    /// <summary>
    /// Calculates quote amount with age loading and tax (age >= 60).
    /// </summary>
    public decimal CalculateQuote(int age, decimal baseAmount)
    {
        decimal result = baseAmount;
        if (age >= SeniorAgeThreshold)
        {
            result = result + (baseAmount * LoadingRate);
        }
        result = result + (result * QuoteTaxRate);
        return result;
    }
}
