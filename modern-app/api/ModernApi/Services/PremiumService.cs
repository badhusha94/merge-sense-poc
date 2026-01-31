namespace ModernApi.Services;

/// <summary>
/// Premium calculation service. Intentional logic drift: uses age > 65 instead of > 60.
/// </summary>
public class PremiumService
{
    /// <summary>
    /// Calculates premium with age loading and tax.
    /// </summary>
    public decimal CalculatePremium(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age > 65) // Intentional drift: legacy used > 60
        {
            amount += baseAmount * 0.20m; // 20% loading
        }
        amount += amount * 0.05m; // 5% tax
        return amount;
    }
}
