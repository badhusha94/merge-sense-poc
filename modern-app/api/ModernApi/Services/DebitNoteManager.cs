using System.Collections.Concurrent;
using ModernApi.Models;

namespace ModernApi.Services;

/// <summary>
/// Manages debit note lifecycle — creation, retrieval, modification, removal.
/// </summary>
public class DebitNoteManager
{
    private const decimal TAX_PERCENT = 0.05m;
    private const int MIN_TENURE_FOR_BONUS = 5;
    private const decimal BONUS_MULTIPLIER = 0.10m;
    private const decimal ADJUSTMENT_CAP = 0.50m;

    private readonly ConcurrentDictionary<Guid, DebitNote> _records = new();

    public DebitNote Add(NewDebitNotePayload payload)
    {
        var entry = new DebitNote
        {
            DebitNoteId = Guid.NewGuid(),
            ReferenceNumber = payload.ReferenceNumber,
            ClientName = payload.ClientName,
            OriginalInvoiceAmount = payload.OriginalInvoiceAmount,
            AdjustmentRate = payload.AdjustmentRate,
            TenureYears = payload.TenureYears,
            Remarks = payload.Remarks ?? "",
            GeneratedOn = DateTimeOffset.UtcNow.DateTime,
            State = DebitNoteState.Pending
        };

        entry.DebitValue = ComputeDebitValue(
            entry.OriginalInvoiceAmount, entry.AdjustmentRate, entry.TenureYears);

        _records.TryAdd(entry.DebitNoteId, entry);
        return entry;
    }

    public DebitNote? FindById(Guid debitNoteId)
    {
        _records.TryGetValue(debitNoteId, out var record);
        return record;
    }

    public List<DebitNote> FetchAll()
    {
        var all = new List<DebitNote>();
        foreach (var pair in _records)
            all.Add(pair.Value);
        return all;
    }

    public List<DebitNote> FetchByState(DebitNoteState targetState)
    {
        var matched = new List<DebitNote>();
        foreach (var pair in _records)
        {
            if (pair.Value.State == targetState)
                matched.Add(pair.Value);
        }
        return matched;
    }

    public List<DebitNote> FetchByClient(string clientName)
    {
        var matched = new List<DebitNote>();
        if (clientName == null) return matched;

        foreach (var pair in _records)
        {
            if (pair.Value.ClientName != null
                && string.Equals(pair.Value.ClientName, clientName, StringComparison.OrdinalIgnoreCase))
            {
                matched.Add(pair.Value);
            }
        }
        return matched;
    }

    public DebitNote? Modify(Guid debitNoteId, ModifyDebitNotePayload changes)
    {
        if (!_records.TryGetValue(debitNoteId, out var record))
            return null;

        if (changes.ClientName != null) record.ClientName = changes.ClientName;
        if (changes.AdjustmentRate.HasValue) record.AdjustmentRate = changes.AdjustmentRate.Value;
        if (changes.TenureYears.HasValue) record.TenureYears = changes.TenureYears.Value;
        if (changes.State.HasValue) record.State = changes.State.Value;
        if (changes.Remarks != null) record.Remarks = changes.Remarks;

        record.DebitValue = ComputeDebitValue(
            record.OriginalInvoiceAmount, record.AdjustmentRate, record.TenureYears);

        _records[debitNoteId] = record;
        return record;
    }

    public bool Remove(Guid debitNoteId)
    {
        return _records.TryRemove(debitNoteId, out _);
    }

    public decimal ComputeDebitValue(decimal invoiceAmount, decimal adjustmentRate, int tenureYears)
    {
        if (invoiceAmount <= 0m)
            return 0m;

        var rate = adjustmentRate > ADJUSTMENT_CAP ? ADJUSTMENT_CAP : adjustmentRate;

        var baseDebit = invoiceAmount * rate;

        var afterTax = baseDebit - (baseDebit * TAX_PERCENT);

        if (tenureYears > MIN_TENURE_FOR_BONUS)
            afterTax += afterTax * BONUS_MULTIPLIER;

        return afterTax;
    }

    public DebitNoteOverview Summarize(DebitNote note)
    {
        return new DebitNoteOverview(
            note.DebitNoteId,
            note.ReferenceNumber,
            note.ClientName,
            note.DebitValue,
            note.State,
            note.GeneratedOn);
    }
}
