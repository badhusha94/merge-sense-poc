namespace ModernApi.Models;

public record CreateCreditNoteRequest(
    string InvoiceNumber,
    string CustomerName,
    decimal InvoiceAmount,
    decimal ReturnPercent,
    int LoyaltyYears,
    string? Notes
);

public record UpdateCreditNoteRequest(
    string? CustomerName,
    decimal? ReturnPercent,
    int? LoyaltyYears,
    CreditNoteStatus? Status,
    string? Notes
);

public record CreditNoteSummary(
    Guid Id,
    string InvoiceNumber,
    string CustomerName,
    decimal CreditAmount,
    CreditNoteStatus Status,
    DateTime CreatedAt
);
