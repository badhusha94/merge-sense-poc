using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClaimsController : ControllerBase
{
    private readonly ClaimsService _claimsService;

    public ClaimsController(ClaimsService claimsService)
    {
        _claimsService = claimsService;
    }

    [HttpGet]
    public IActionResult GetClaimAmount([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var amount = _claimsService.CalculateClaimAmount(age, baseAmount);
        return Ok(new { amount });
    }
}
