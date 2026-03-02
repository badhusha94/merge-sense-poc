using System;

namespace LegacyApp
{
    /// <summary>
    /// Engine for computing debit adjustments on invoices.
    /// </summary>
    public class DebitAdjustmentEngine
    {
        private readonly decimal _taxPercent = 0.05m;
        private readonly int _loyaltyMinYears = 5;
        private readonly decimal _loyaltyRate = 0.10m;
        private readonly decimal _ceiling = 0.50m;

        public decimal DetermineAdjustment(decimal invoiceTotal, decimal proportion, int yearsActive)
        {
            if (invoiceTotal <= 0m) return 0m;

            decimal clampedProportion = proportion;
            if (clampedProportion > _ceiling) clampedProportion = _ceiling;

            decimal preliminary = invoiceTotal * clampedProportion;
            preliminary = preliminary * (1m - _taxPercent);

            // Logic drift: uses > instead of >= for loyalty check
            return yearsActive > _loyaltyMinYears
                ? preliminary * (1m + _loyaltyRate)
                : preliminary;
        }

        public decimal FetchAdjustmentTotal(decimal inv, decimal prop, int tenure)
        {
            return DetermineAdjustment(inv, prop, tenure);
        }

        public decimal DetermineAdjustmentWithManualRate(
            decimal invoiceTotal, decimal proportion, int yearsActive, decimal manualRate)
        {
            if (invoiceTotal <= 0m)
                return 0m;

            decimal p = proportion > _ceiling ? _ceiling : proportion;
            decimal val = invoiceTotal * p;
            val *= (1m - _taxPercent);

            if (manualRate > 0m)
            {
                val = val * (1m + manualRate);
            }
            else
            {
                if (yearsActive > _loyaltyMinYears)
                    val = val * (1m + _loyaltyRate);
            }
            return val;
        }

        public bool QualifiesForDebit(decimal invoiceTotal, string invoiceState)
        {
            if (invoiceState == null) return false;
            bool isPaidOrSettled = invoiceState == "Paid" || invoiceState == "Settled";
            return isPaidOrSettled && invoiceTotal > 0;
        }
    }
}
