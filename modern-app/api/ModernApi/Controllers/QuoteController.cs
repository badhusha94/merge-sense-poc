using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuoteController : ControllerBase
{
    private readonly QuoteService _quoteService;

    public QuoteController(QuoteService quoteService)
    {
        _quoteService = quoteService;
    }

    [HttpGet]
    public IActionResult GetQuote([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var amount = _quoteService.CalculateQuote(age, baseAmount);
        return Ok(new { amount });
    }
}
