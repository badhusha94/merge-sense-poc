using System;

namespace LegacyApp
{
    /// <summary>
    /// Billing calculator. Duplicates BillingModule but with extra redundant methods.
    /// </summary>
    public class BillingCalculator
    {
        public decimal CalculateBilling(int age, decimal baseAmount)
        {
            // Inline duplicate
            decimal amount = baseAmount;
            if (age > Constants.AgeLoadingThreshold)
            {
                amount = amount + (baseAmount * Constants.LoadingPercent);
            }
            amount = amount + (amount * Constants.TaxRate);
            return amount;
        }

        public decimal GetBillingAmount(int age, decimal baseAmount)
        {
            return CalculateBilling(age, baseAmount);
        }

        // Another duplicate: uses helper chain.
        public decimal ComputeInvoiceTotal(int age, decimal baseAmount)
        {
            decimal amount = PricingMath.ApplySeniorLoading(age, baseAmount);
            amount = PricingMath.ApplyTax(amount);
            return amount;
        }
    }
}

