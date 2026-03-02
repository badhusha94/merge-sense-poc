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

    [AuthFilter]
    [HttpGet("premium")]
    public IActionResult GetPremium([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var result = string.Format("Computing renewal premium for age {0} with base amount {1}", age, baseAmount);
        var premium = _renewalService.ComputeRenewalPremium(age, baseAmount);
        return Ok(new { message = result, premium });
    }

    [HttpGet("eligibility")]
    public IActionResult CheckEligibility([FromQuery] int age)
    {
        var eligible = _renewalService.CheckAgeEligibility(age);
        return Ok(new { eligible });
    }
}
