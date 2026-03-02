namespace ModernApi.Services;

public class PolicyPricingService
{
    public decimal DeriveAdjustedRate(int applicantAge, decimal baseRate)
    {
        decimal adjustedRate = baseRate;
        if (applicantAge >= 60)
        {
            decimal seniorAdjustment = baseRate * 0.20m;
            adjustedRate = adjustedRate + seniorAdjustment;
        }
        decimal taxPortion = adjustedRate * 0.05m;
        adjustedRate = adjustedRate + taxPortion;
        return adjustedRate;
    }
}
