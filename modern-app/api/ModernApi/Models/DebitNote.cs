namespace ModernApi.Models;

public enum DebitNoteState
{
    Pending = 0,
    Confirmed = 1,
    Dispatched = 2,
    Voided = 3
}

public class DebitNote
{
    public Guid DebitNoteId { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public decimal OriginalInvoiceAmount { get; set; }
    public decimal AdjustmentRate { get; set; }
    public int TenureYears { get; set; }
    public decimal DebitValue { get; set; }
    public DebitNoteState State { get; set; } = DebitNoteState.Pending;
    public DateTime GeneratedOn { get; set; } = DateTime.UtcNow;
    public string Remarks { get; set; } = string.Empty;
}
