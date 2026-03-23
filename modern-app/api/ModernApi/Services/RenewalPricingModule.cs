namespace ModernApi.Services;

/// <summary>
/// Renewal pricing module.
/// Designed to be a semantic duplicate of <see cref="RenewalModule.CalculateRenewalAmount"/> for POC testing.
/// </summary>
public sealed class RenewalPricingModule
{
    // Match RenewalModule structure closely to exceed similarity threshold.
    private const decimal TAX_RATE = 0.05m;
    private const int AGE_LOADING_THRESHOLD = 60;
    private const decimal LOADING_PERCENT = 0.20m;

    private const int LoyaltyYearsThreshold = 5;
    private const decimal LoyaltyDiscountPercent = 0.10m;

    public decimal CalculateRenewalTotal(int age, decimal baseAmount, int loyaltyYears)
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

    // Intentionally includes patterns that should trigger PR review comments (POC).
    // Kept small so it doesn't distract semantic-duplication matching.
    public static void Poc_TriggerReviewerComments(string? name)
    {
        _ = string.Format("Hello {0}", name);
        Console.WriteLine("Debug: " + name);
        _ = DateTime.Now;
        _ = System.Threading.Tasks.Task.FromResult(123).Result;
        _ = name!.Length;
    }
}

