namespace ModernApi.Models;

public record NewDebitNotePayload(
    string ReferenceNumber,
    string ClientName,
    decimal OriginalInvoiceAmount,
    decimal AdjustmentRate,
    int TenureYears,
    string? Remarks
);

public record ModifyDebitNotePayload(
    string? ClientName,
    decimal? AdjustmentRate,
    int? TenureYears,
    DebitNoteState? State,
    string? Remarks
);

public record DebitNoteOverview(
    Guid DebitNoteId,
    string ReferenceNumber,
    string ClientName,
    decimal DebitValue,
    DebitNoteState State,
    DateTime GeneratedOn
);
