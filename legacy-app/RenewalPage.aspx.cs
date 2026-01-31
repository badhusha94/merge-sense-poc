using System;
using System.Collections.Generic;

namespace LegacyApp
{
    public partial class RenewalPage
    {
        /// <summary>
        /// Computes renewal premium with age loading and tax.
        /// Same business intent as CalculatePremium but written differently.
        /// </summary>
        public decimal ComputeRenewalPremium(int age, decimal baseAmount)
        {
            decimal result = baseAmount;
            if (age >= 60)
            {
                result = result + (baseAmount * 0.20m); // 20% loading
            }
            result = result + (result * 0.05m); // 5% tax
            return result;
        }
    }
}
