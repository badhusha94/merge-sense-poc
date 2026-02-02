using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RenewalController : ControllerBase
{
    private readonly RenewalService _renewalService;

    public RenewalController(RenewalService renewalService)
    {
        _renewalService = renewalService;
    }

    [HttpGet]
    public IActionResult GetRenewalPremium([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var premium = _renewalService.ComputeRenewalPremium(age, baseAmount);
        return Ok(new { premium });
    }
}
