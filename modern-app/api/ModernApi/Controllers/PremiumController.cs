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
    public IActionResult Get([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var amount = _premiumService.CalculatePremium(age, baseAmount);
        return Ok(new { amount });
    }
}

