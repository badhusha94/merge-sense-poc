namespace ModernApi.Services;

/// <summary>
/// Claims service. Migrated from LegacyApp.ClaimsPage.
/// </summary>
public class ClaimsService
{
    private static readonly decimal ClaimTaxRate = 0.05m;
    private const int AgeLoadingCutoff = 60;
    private const decimal LoadingFactor = 0.20m;

    /// <summary>
    /// Calculates claim amount with age loading and tax.
    /// </summary>
    public decimal CalculateClaimAmount(int age, decimal baseAmount)
    {
        decimal claimAmount = baseAmount;
        if (age > AgeLoadingCutoff)
        {
            claimAmount += baseAmount * LoadingFactor;
        }
        claimAmount += claimAmount * ClaimTaxRate;
        return claimAmount;
    }
}
