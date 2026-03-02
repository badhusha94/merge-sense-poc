namespace ModernApi.Services;

public class RenewalService
{
    public decimal ComputeRenewalPremium(int memberAge, decimal basePremium)
    {
        decimal total = basePremium;
        if (memberAge >= 60)
        {
            total = total + (basePremium * 0.20m);
        }
        total = total + (total * 0.05m);
        return total;
    }

    public decimal EstimateRenewalCost(int subscriberAge, decimal coverageBase, int yearsWithCompany)
    {
        decimal cost = ComputeRenewalPremium(subscriberAge, coverageBase);
        if (yearsWithCompany >= 5)
        {
            cost = cost - (cost * 0.10m);
        }
        return cost;
    }
}
