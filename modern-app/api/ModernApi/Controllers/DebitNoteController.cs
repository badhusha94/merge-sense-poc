using Microsoft.AspNetCore.Mvc;
using ModernApi.Models;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/v1/debit-notes")]
[AuthFilter]
public class DebitNoteController : ControllerBase
{
    private readonly DebitNoteManager manager;
    private readonly DebitNoteReportGenerator reporter;

    public DebitNoteController(DebitNoteManager manager, DebitNoteReportGenerator reporter)
    {
        this.manager = manager;
        this.reporter = reporter;
    }

    [HttpGet]
    public ActionResult<List<DebitNoteOverview>> ListAll(
        [FromQuery] DebitNoteState? state, [FromQuery] string? client)
    {
        List<DebitNote> records;

        if (state.HasValue)
            records = manager.FetchByState(state.Value);
        else if (!string.IsNullOrEmpty(client))
            records = manager.FetchByClient(client);
        else
            records = manager.FetchAll();

        var overviews = new List<DebitNoteOverview>();
        foreach (var rec in records)
            overviews.Add(manager.Summarize(rec));

        return Ok(overviews);
    }

    [HttpGet("{id:guid}")]
    public ActionResult<DebitNote> Retrieve(Guid id)
    {
        var record = manager.FindById(id);
        if (record == null) return NotFound();
        return Ok(record);
    }

    [HttpPost]
    public ActionResult<DebitNote> Issue([FromBody] NewDebitNotePayload payload)
    {
        if (payload.OriginalInvoiceAmount <= 0)
            return BadRequest("Original invoice amount must be positive.");

        if (payload.AdjustmentRate <= 0 || payload.AdjustmentRate > 1)
            return BadRequest("Adjustment rate must be between 0 and 1.");

        if (string.IsNullOrWhiteSpace(payload.ReferenceNumber))
            return BadRequest("Reference number is required.");

        if (string.IsNullOrWhiteSpace(payload.ClientName))
            return BadRequest("Client name is required.");

        var created = manager.Add(payload);
        return CreatedAtAction(nameof(Retrieve), new { id = created.DebitNoteId }, created);
    }

    [HttpPut("{id:guid}")]
    [AuthFilter]
    public ActionResult<DebitNote> Revise(Guid id, [FromBody] ModifyDebitNotePayload payload)
    {
        var revised = manager.Modify(id, payload);
        if (revised == null) return NotFound();
        return Ok(revised);
    }

    [HttpDelete("{id:guid}")]
    [AuthFilter]
    public ActionResult Discard(Guid id)
    {
        if (!manager.Remove(id)) return NotFound();
        return NoContent();
    }

    [HttpGet("{id:guid}/compute")]
    [AuthFilter]
    public ActionResult<decimal> Compute(Guid id)
    {
        var record = manager.FindById(id);
        if (record == null) return NotFound();

        var value = manager.ComputeDebitValue(
            record.OriginalInvoiceAmount, record.AdjustmentRate, record.TenureYears);
        return Ok(value);
    }

    [HttpGet("export/csv")]
    [AuthFilter]
    public IActionResult DownloadCsv([FromQuery] DebitNoteState? state)
    {
        var records = state.HasValue
            ? manager.FetchByState(state.Value)
            : manager.FetchAll();

        var bytes = reporter.GenerateCsvBytes(records);
        return File(bytes, "text/csv", $"debit-notes-{DateTimeOffset.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("export/html")]
    [AuthFilter]
    public ContentResult DownloadHtml([FromQuery] DebitNoteState? state)
    {
        var records = state.HasValue
            ? manager.FetchByState(state.Value)
            : manager.FetchAll();

        var html = reporter.GenerateHtmlDocument(records);
        return Content(html, "text/html");
    }
}
