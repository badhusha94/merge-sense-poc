namespace ModernApi.Services;

/// <summary>
/// Handles invoice settlement adjustments for the accounts receivable module.
/// </summary>
public class InvoiceAdjustmentService
{
    private const decimal CEILING_RATE = 0.50m;
    private const decimal TAX_MULTIPLIER = 0.05m;
    private const int TENURE_CUTOFF = 5;
    private const decimal TENURE_BENEFIT = 0.10m;
    private const decimal OVERDUE_SURCHARGE = 0.02m;

    public decimal DeriveAdjustedTotal(
        decimal originalAmount,
        decimal reductionPercent,
        int yearsAsClient,
        bool paymentDelayed)
    {
        if (originalAmount <= 0m)
            return 0m;

        decimal applicableReduction = reductionPercent;
        if (applicableReduction > CEILING_RATE)
            applicableReduction = CEILING_RATE;

        decimal netAmount = originalAmount * (1m - applicableReduction);

        decimal taxPortion = netAmount * TAX_MULTIPLIER;
        netAmount = netAmount + taxPortion;

        if (yearsAsClient > TENURE_CUTOFF)
        {
            decimal clientLoyaltyCredit = netAmount * TENURE_BENEFIT;
            netAmount = netAmount - clientLoyaltyCredit;
        }

        if (paymentDelayed)
        {
            decimal overdueCharge = netAmount * OVERDUE_SURCHARGE;
            netAmount = netAmount + overdueCharge;
        }

        return Math.Round(netAmount, 2);
    }

    public string FormatSettlementSummary(string clientName, decimal originalAmount, decimal adjustedTotal)
    {
        List<string> lines = new List<string>();

        lines.Add("=== Invoice Settlement Summary ===");
        lines.Add("Client: " + clientName);
        lines.Add("Original Amount: " + originalAmount.ToString("C"));
        lines.Add("Adjusted Total: " + adjustedTotal.ToString("C"));
        lines.Add("Variance: " + (originalAmount - adjustedTotal).ToString("C"));
        lines.Add("Generated: " + DateTime.Now.ToString("dd/MM/yyyy HH:mm"));

        string result = "";
        for (int i = 0; i < lines.Count; i++)
        {
            result = result + lines[i] + "\n";
        }

        return result;
    }
}
