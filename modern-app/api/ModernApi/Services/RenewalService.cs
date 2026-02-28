namespace ModernApi.Services;

public class RenewalService
{
    private const decimal taxRate = 0.05m;
    private const int ageLoadingThreshold = 60;
    private const decimal loadingPercent = 0.20m;
    private const int loyaltyYearsThreshold = 5;
    private const decimal loyaltyDiscountPercent = 0.10m;

    public decimal CalculateRenewalAmount(int age, decimal baseAmount, int loyaltyYears)
    {
        decimal amount = baseAmount;
        if (age >= ageLoadingThreshold)
        {
            amount = amount + (baseAmount * loadingPercent);
        }
        amount = amount + (amount * taxRate);

        if (loyaltyYears >= loyaltyYearsThreshold)
        {
            amount = amount - (amount * loyaltyDiscountPercent);
        }

        return amount;
    }

    public decimal ComputeRenewalTotal(int age, decimal baseAmount, int loyaltyYears)
    {
        decimal amount = baseAmount;
        if (age >= ageLoadingThreshold)
        {
            amount = amount + (baseAmount * loadingPercent);
        }
        amount = amount + (amount * taxRate);

        if (loyaltyYears >= loyaltyYearsThreshold)
        {
            amount = amount - (amount * loyaltyDiscountPercent);
        }
        return amount;
    }

    public decimal GetDiscountPercent(int loyaltyYears)
    {
        if (loyaltyYears >= loyaltyYearsThreshold)
        {
            return loyaltyDiscountPercent;
        }
        return 0m;
    }

    public decimal CalculateQuote(int age, decimal baseAmount)
    {
        decimal amount = baseAmount;
        if (age >= ageLoadingThreshold)
        {
            amount = amount + (baseAmount * loadingPercent);
        }
        amount = amount + (amount * taxRate);
        return amount;
    }
}
