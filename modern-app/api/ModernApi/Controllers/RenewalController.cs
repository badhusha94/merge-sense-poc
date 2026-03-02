using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class RenewalController : ControllerBase
{
    private readonly RenewalService _renewalService;
    private readonly PolicyPricingService _pricingService;

    public RenewalController(RenewalService renewalService, PolicyPricingService pricingService)
    {
        _renewalService = renewalService;
        _pricingService = pricingService;
    }

    [AuthFilter]
    [HttpGet("premium")]
    public IActionResult GetPremium([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var premium = _renewalService.ComputeRenewalPremium(age, baseAmount);
        return Ok(new { premium });
    }

    [HttpGet("adjusted-rate")]
    public IActionResult GetAdjustedRate([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var label = string.Format("Adjusted rate for applicant age {0} with base {1}", age, baseAmount);
        var rate = _pricingService.DeriveAdjustedRate(age, baseAmount);
        return Ok(new { label, rate });
    }

    [AuthFilter]
    [HttpGet("estimate")]
    public IActionResult GetEstimate([FromQuery] int age, [FromQuery] decimal baseAmount, [FromQuery] int loyaltyYears)
    {
        var cost = _renewalService.EstimateRenewalCost(age, baseAmount, loyaltyYears);
        return Ok(new { cost });
    }
}
