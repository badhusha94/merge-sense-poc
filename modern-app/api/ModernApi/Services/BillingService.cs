namespace ModernApi.Services;

/// <summary>
/// Billing service (migrated from LegacyApp.BillingModule).
/// Intentionally duplicates quote pricing logic for semantic-duplication PR review demos.
/// </summary>
public class BillingService
{
    private const decimal TAX_RATE = 0.05m;
    private const int AGE_LOADING_THRESHOLD = 60;
    private const decimal LOADING_PERCENT = 0.20m;
    private const decimal TaxRate = 0.05m;

    public decimal GetBillingAmount(int age, decimal baseAmount)
    {
        // Intentional semantic duplicate of QuoteService.CalculateQuote (same formula/threshold).
        decimal amount = baseAmount;
        if (age >= AGE_LOADING_THRESHOLD)
        {
            amount = amount + (baseAmount * LOADING_PERCENT);
        }
        amount = amount + (amount * TaxRate);
        return amount;
    }

    // Redundant wrapper (semantic duplicate)
    public decimal CalculateInvoiceTotal(int age, decimal baseAmount)
    {
        return GetBillingAmount(age, baseAmount);
    }

    // Another intentional duplicate: same logic, different name.
    public decimal CalculateQuote(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age >= AGE_LOADING_THRESHOLD)
        {
            amount = amount + (baseAmount * LOADING_PERCENT);
        }
        amount = amount + (amount * TAX_RATE);
        return amount;
    }
}

