using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PremiumController : ControllerBase
{
    private readonly PremiumService _premiumService;

    public PremiumController(PremiumService premiumService)
    {
        _premiumService = premiumService;
    }

    [HttpGet]
    public IActionResult GetPremium([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var premium = _premiumService.CalculatePremium(age, baseAmount);
        return Ok(new { premium });
    }
}
