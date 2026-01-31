namespace ModernApi.Services;

/// <summary>
/// Renewal service. Migrated from LegacyApp.RenewalPage.
/// </summary>
public class RenewalService
{
    private const decimal RenewalTaxRate = 0.05m;
    private const int SeniorThreshold = 60;
    private const decimal LoadingRate = 0.20m;

    /// <summary>
    /// Computes renewal premium with age loading and tax (age >= 60).
    /// </summary>
    public decimal ComputeRenewalPremium(int age, decimal baseAmount)
    {
        decimal result = baseAmount;
        if (age >= SeniorThreshold)
        {
            result = result + (baseAmount * LoadingRate);
        }
        result = result + (result * RenewalTaxRate);
        return result;
    }
}
