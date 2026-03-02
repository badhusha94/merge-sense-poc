using System;

namespace LegacyApp
{
    /// <summary>
    /// Another credit note calculator. Intentionally overlaps CreditNoteModule.
    /// </summary>
    public class CreditNoteCalculator
    {
        private const decimal TaxRate = 0.05m;
        private const int LoyaltyThreshold = 5;
        private const decimal LoyaltyDiscount = 0.10m;
        private const decimal MaxCreditPercent = 0.50m;

        // Drift: uses > instead of >= for loyalty threshold (different from CreditNoteModule).
        public decimal ComputeCredit(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)
        {
            if (invoiceAmount <= 0)
            {
                return 0m;
            }

            decimal pct = returnPercent;
            if (pct > MaxCreditPercent)
            {
                pct = MaxCreditPercent;
            }

            decimal credit = invoiceAmount * pct;

            decimal taxAdj = credit * TaxRate;
            credit = credit - taxAdj;

            if (loyaltyYears > LoyaltyThreshold)
            {
                decimal bonus = credit * LoyaltyDiscount;
                credit = credit + bonus;
            }

            return credit;
        }

        // Semantic duplicate wrapper.
        public decimal GetCreditTotal(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)
        {
            return ComputeCredit(invoiceAmount, returnPercent, loyaltyYears);
        }

        public decimal ComputeCreditWithOverride(decimal invoiceAmount, decimal returnPercent, int loyaltyYears, decimal overrideDiscount)
        {
            if (invoiceAmount <= 0)
            {
                return 0m;
            }

            decimal pct = returnPercent;
            if (pct > MaxCreditPercent)
            {
                pct = MaxCreditPercent;
            }

            decimal credit = invoiceAmount * pct;

            decimal taxAdj = credit * TaxRate;
            credit = credit - taxAdj;

            if (overrideDiscount > 0)
            {
                credit = credit + (credit * overrideDiscount);
            }
            else if (loyaltyYears > LoyaltyThreshold)
            {
                decimal bonus = credit * LoyaltyDiscount;
                credit = credit + bonus;
            }

            return credit;
        }

        public bool IsEligibleForCredit(decimal invoiceAmount, string status)
        {
            if (status == null)
            {
                return false;
            }
            if (status == "Paid" || status == "Settled")
            {
                if (invoiceAmount > 0)
                {
                    return true;
                }
            }
            return false;
        }
    }
}
