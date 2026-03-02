using Microsoft.AspNetCore.Mvc;
using ModernApi.Models;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/v1/credit-notes")]
[AuthFilter]
public class CreditNoteController : ControllerBase
{
    private readonly CreditNoteService creditNoteService;
    private readonly CreditNoteExportService exportService;

    public CreditNoteController(CreditNoteService creditNoteService, CreditNoteExportService exportService)
    {
        this.creditNoteService = creditNoteService;
        this.exportService = exportService;
    }

    [HttpGet]
    public ActionResult<List<CreditNoteSummary>> GetAll([FromQuery] CreditNoteStatus? status, [FromQuery] string? customer)
    {
        List<CreditNote> notes;

        if (status != null)
        {
            notes = creditNoteService.GetByStatus(status.Value);
        }
        else if (customer != null)
        {
            notes = creditNoteService.GetByCustomer(customer);
        }
        else
        {
            notes = creditNoteService.GetAll();
        }

        List<CreditNoteSummary> summaries = new List<CreditNoteSummary>();
        for (int i = 0; i < notes.Count; i++)
        {
            summaries.Add(creditNoteService.ToSummary(notes[i]));
        }

        return Ok(summaries);
    }

    [HttpGet("{id}")]
    public ActionResult<CreditNote> GetById(Guid id)
    {
        var note = creditNoteService.GetById(id);
        if (note == null)
        {
            return NotFound();
        }
        return Ok(note);
    }

    [HttpPost]
    public ActionResult<CreditNote> Create([FromBody] CreateCreditNoteRequest request)
    {
        if (request.InvoiceAmount <= 0)
        {
            return BadRequest("Invoice amount must be greater than zero.");
        }
        if (request.ReturnPercent <= 0 || request.ReturnPercent > 1)
        {
            return BadRequest("Return percent must be between 0 and 1.");
        }
        if (string.IsNullOrWhiteSpace(request.InvoiceNumber))
        {
            return BadRequest("Invoice number is required.");
        }
        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            return BadRequest("Customer name is required.");
        }

        var note = creditNoteService.Create(request);
        return CreatedAtAction(nameof(GetById), new { id = note.Id }, note);
    }

    [HttpPut("{id}")]
    [AuthFilter]
    public ActionResult<CreditNote> Update(Guid id, [FromBody] UpdateCreditNoteRequest request)
    {
        var updated = creditNoteService.Update(id, request);
        if (updated == null)
        {
            return NotFound();
        }
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    [AuthFilter]
    public ActionResult Delete(Guid id)
    {
        var deleted = creditNoteService.Delete(id);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpGet("{id}/calculate")]
    [AuthFilter]
    public ActionResult<decimal> Calculate(Guid id)
    {
        var note = creditNoteService.GetById(id);
        if (note == null)
        {
            return NotFound();
        }

        decimal amount = creditNoteService.CalculateCreditAmount(
            note.InvoiceAmount, note.ReturnPercent, note.LoyaltyYears);
        return Ok(amount);
    }

    [HttpGet("export/csv")]
    [AuthFilter]
    public IActionResult ExportCsv([FromQuery] CreditNoteStatus? status)
    {
        List<CreditNote> notes;
        if (status != null)
        {
            notes = creditNoteService.GetByStatus(status.Value);
        }
        else
        {
            notes = creditNoteService.GetAll();
        }

        byte[] csvBytes = exportService.ExportToCsv(notes);
        return File(csvBytes, "text/csv", "credit-notes-" + DateTime.Now.ToString("yyyyMMdd") + ".csv");
    }

    [HttpGet("export/html")]
    [AuthFilter]
    public ActionResult<string> ExportHtml([FromQuery] CreditNoteStatus? status)
    {
        List<CreditNote> notes;
        if (status != null)
        {
            notes = creditNoteService.GetByStatus(status.Value);
        }
        else
        {
            notes = creditNoteService.GetAll();
        }

        string html = exportService.ExportToHtml(notes);
        return Content(html, "text/html");
    }
}