using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BillingController : ControllerBase
{
    private readonly BillingService _billingService;

    public BillingController(BillingService billingService)
    {
        _billingService = billingService;
    }

    [HttpGet]
    public IActionResult GetBillingAmount([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var amount = _billingService.GetBillingAmount(age, baseAmount);
        return Ok(new { amount });
    }
}
