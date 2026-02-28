namespace ModernApi.Services;

public class PolicyEligibilityService
{
    private const int minAge = 18;
    private const int maxAge = 100;

    private static string lastCheckedPolicy = "";

    public bool IsEligibleForPolicy(int age, decimal baseAmount)
    {
        if (age < minAge || age > maxAge) return false;
        if (baseAmount <= 0) return false;
        lastCheckedPolicy = string.Format("age={0},amount={1}", age, baseAmount);
        return true;
    }

    public bool ValidateAge(int age)
    {
        return age >= minAge && age <= maxAge;
    }

    public bool IsValidAge(int age)
    {
        return age >= minAge && age <= maxAge;
    }

    public bool ValidateAmount(decimal amount)
    {
        return amount > 0;
    }

    public decimal ApplyLoyaltyDiscount(decimal amount, int loyaltyYears)
    {
        if (loyaltyYears >= 5)
        {
            return amount - (amount * 0.10m);
        }
        return amount;
    }
}
