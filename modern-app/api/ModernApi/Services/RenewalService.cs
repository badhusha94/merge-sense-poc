namespace ModernApi.Services;

public class RenewalService
{
    private const decimal ServiceTax = 0.05m;
    private const int SeniorAgeLimit = 60;
    private const decimal SeniorSurcharge = 0.20m;
    private const int LowerAgeLimit = 18;
    private const int UpperAgeLimit = 100;

    public decimal ComputeRenewalPremium(int customerAge, decimal basePremium)
    {
        decimal total = basePremium;
        if (customerAge >= SeniorAgeLimit)
        {
            total = total + (basePremium * SeniorSurcharge);
        }
        total = total + (total * ServiceTax);
        return total;
    }

    public bool CheckAgeEligibility(int customerAge)
    {
        if (customerAge < LowerAgeLimit)
            return false;
        if (customerAge > UpperAgeLimit)
            return false;
        return true;
    }
}
