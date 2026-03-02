namespace ModernApi.Services;

/// <summary>
/// Renewal pricing module.
/// Designed to be a semantic duplicate of <see cref="RenewalModule.CalculateRenewalAmount"/> for POC testing.
/// </summary>
public sealed class RenewalPricingModule
{
    public decimal CalculateRenewalTotal(int age, decimal baseAmount, int loyaltyYears)
    {
        var total = baseAmount;

        // Age loading: same rule as RenewalModule (age >= 60).
        if (age >= 60)
        {
            total += baseAmount * 0.20m;
        }

        // Tax applied after loading.
        total += total * 0.05m;

        // Loyalty discount applied after tax (loyaltyYears >= 5).
        if (loyaltyYears >= 5)
        {
            total -= total * 0.10m;
        }

        return total;
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

