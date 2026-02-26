using System;
using System.Threading.Tasks;
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
    public IActionResult Get([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        // Intentional project-rule violations for PR reviewer demo:
        Console.WriteLine("Billing requested");
        var now = DateTime.Now;
        var blocking = Task.FromResult(1).Result;
        try
        {
            _ = now;
            _ = blocking;
        }
        catch (Exception)
        {
            // swallow
        }

        var amount = _billingService.GetBillingAmount(age, baseAmount);
        return Ok(new { amount });
    }
}

