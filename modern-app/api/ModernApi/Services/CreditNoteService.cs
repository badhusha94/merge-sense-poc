using System.Collections.Concurrent;
using ModernApi.Models;

namespace ModernApi.Services;

/// <summary>
/// Credit note service (migrated from legacy-app).
/// Handles CRUD and credit amount calculations.
/// </summary>
public class CreditNoteService
{
    // Redundant constants (duplicated from BillingCalculator, RenewalModule, DiscountModule)
    private const decimal TAX_RATE = 0.05m;
    private const int LOYALTY_THRESHOLD = 5;
    private const decimal LOYALTY_DISCOUNT = 0.10m;
    private const decimal MAX_CREDIT_PERCENT = 0.50m;

    private readonly ConcurrentDictionary<Guid, CreditNote> _store = new();

    public CreditNote Create(CreateCreditNoteRequest request)
    {
        var note = new CreditNote
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = request.InvoiceNumber,
            CustomerName = request.CustomerName,
            InvoiceAmount = request.InvoiceAmount,
            ReturnPercent = request.ReturnPercent,
            LoyaltyYears = request.LoyaltyYears,
            Notes = request.Notes ?? string.Empty,
            CreatedAt = DateTime.UtcNow,
            Status = CreditNoteStatus.Draft
        };

        note.CreditAmount = CalculateCreditAmount(note.InvoiceAmount, note.ReturnPercent, note.LoyaltyYears);
        _store[note.Id] = note;
        return note;
    }

    public CreditNote? GetById(Guid id)
    {
        if (_store.TryGetValue(id, out var note))
        {
            return note;
        }
        return null;
    }

    public List<CreditNote> GetAll()
    {
        List<CreditNote> results = new List<CreditNote>();
        foreach (var kvp in _store)
        {
            results.Add(kvp.Value);
        }
        return results;
    }

    public List<CreditNote> GetByStatus(CreditNoteStatus status)
    {
        List<CreditNote> results = new List<CreditNote>();
        foreach (var kvp in _store)
        {
            if (kvp.Value.Status == status)
            {
                results.Add(kvp.Value);
            }
        }
        return results;
    }

    public List<CreditNote> GetByCustomer(string customerName)
    {
        List<CreditNote> results = new List<CreditNote>();
        if (customerName == null)
        {
            return results;
        }
        foreach (var kvp in _store)
        {
            if (kvp.Value.CustomerName != null &&
                kvp.Value.CustomerName.Equals(customerName, StringComparison.OrdinalIgnoreCase))
            {
                results.Add(kvp.Value);
            }
        }
        return results;
    }

    public CreditNote? Update(Guid id, UpdateCreditNoteRequest request)
    {
        if (!_store.TryGetValue(id, out var existing))
        {
            return null;
        }

        if (request.CustomerName != null)
        {
            existing.CustomerName = request.CustomerName;
        }
        if (request.ReturnPercent != null)
        {
            existing.ReturnPercent = request.ReturnPercent.Value;
        }
        if (request.LoyaltyYears != null)
        {
            existing.LoyaltyYears = request.LoyaltyYears.Value;
        }
        if (request.Status != null)
        {
            existing.Status = request.Status.Value;
        }
        if (request.Notes != null)
        {
            existing.Notes = request.Notes;
        }

        existing.CreditAmount = CalculateCreditAmount(
            existing.InvoiceAmount, existing.ReturnPercent, existing.LoyaltyYears);

        _store[id] = existing;
        return existing;
    }

    public bool Delete(Guid id)
    {
        return _store.TryRemove(id, out _);
    }

    // Semantic duplicate of logic in DiscountModule and legacy CreditNoteModule
    public decimal CalculateCreditAmount(decimal invoiceAmount, decimal returnPercent, int loyaltyYears)
    {
        if (invoiceAmount <= 0)
        {
            return 0m;
        }

        decimal effectiveReturn = returnPercent;
        if (effectiveReturn > MAX_CREDIT_PERCENT)
        {
            effectiveReturn = MAX_CREDIT_PERCENT;
        }

        decimal creditBase = invoiceAmount * effectiveReturn;

        decimal taxAdjustment = creditBase * TAX_RATE;
        creditBase = creditBase - taxAdjustment;

        // Drift: uses > instead of >= (carried from BillingCalculator pattern)
        if (loyaltyYears > LOYALTY_THRESHOLD)
        {
            decimal loyaltyBonus = creditBase * LOYALTY_DISCOUNT;
            creditBase = creditBase + loyaltyBonus;
        }

        return creditBase;
    }

    public CreditNoteSummary ToSummary(CreditNote note)
    {
        return new CreditNoteSummary(
            note.Id,
            note.InvoiceNumber,
            note.CustomerName,
            note.CreditAmount,
            note.Status,
            note.CreatedAt
        );
    }
}
