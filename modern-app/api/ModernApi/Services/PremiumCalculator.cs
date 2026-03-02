using System;

namespace ModernApi.Services;

/// <summary>
/// Premium calculator (migrated from legacy-app).
/// </summary>
public sealed class PremiumCalculator
{
    private const decimal TAX_RATE = 0.05m;
    private const int AgeLoadingThreshold = 60;
    private const decimal LoadingPercent = 0.20m;

    // Drift: uses >= (different from legacy PremiumModule which uses >).
    public decimal CalculatePremium(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age >= AgeLoadingThreshold)
        {
            amount += baseAmount * LoadingPercent;
        }

        amount += amount * TAX_RATE;
        return amount;
    }

    // Intentionally "bad" patterns to trigger PR reviewer comments (POC).
    public static void Poc_BadCode(string? name)
    {
        const int threshold = 5; // violates ALL_CAPS const rule
        _ = threshold;

        _ = $"Hello {name}"; // C# tip: interpolation
        Console.WriteLine("Debug: " + name); // project-rule: avoid Console; C# tip: interpolation
        _ = DateTime.Now; // project-rule: avoid DateTime.Now
        _ = System.Threading.Tasks.Task.FromResult(123).Result; // project-rule: avoid blocking async
        _ = name!.Length; // project-rule: avoid null-forgiving operator
    }
}