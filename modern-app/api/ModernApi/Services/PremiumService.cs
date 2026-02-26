namespace ModernApi.Services;

/// <summary>
/// Premium calculation service (migrated from LegacyApp.PremiumModule).
/// Intentionally duplicates the quote-style pricing formula for semantic-duplication PR review tests.
/// </summary>
public class PremiumService
{
    private const decimal TaxRate = 0.05m;
    private const int AgeLoadingThreshold = 60;
    private const decimal LoadingPercent = 0.20m;

    // NOTE: Intentionally uses the quote-style rule (age >= 60) to create a semantic duplicate
    // during parallel legacy migrations in the same sprint.
    public decimal CalculatePremium(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age >= AgeLoadingThreshold)
        {
            amount = amount + (baseAmount * LoadingPercent);
        }
        amount = amount + (amount * TaxRate);
        return amount;
    }

    // Redundant wrapper (semantic duplicate).
    public decimal ComputePremiumTotal(int age, decimal baseAmount)
    {
        return CalculatePremium(age, baseAmount);
    }
}

