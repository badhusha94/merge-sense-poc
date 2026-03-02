namespace ModernApi.Models;

public enum CreditNoteStatus
{
    Draft = 0,
    Approved = 1,
    Issued = 2,
    Cancelled = 3
}

public class CreditNote
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public decimal InvoiceAmount { get; set; }
    public decimal ReturnPercent { get; set; }
    public int LoyaltyYears { get; set; }
    public decimal CreditAmount { get; set; }
    public CreditNoteStatus Status { get; set; } = CreditNoteStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Notes { get; set; } = string.Empty;
}
