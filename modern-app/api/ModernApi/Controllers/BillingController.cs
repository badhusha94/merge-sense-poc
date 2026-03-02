using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController(BillingCalculator billing) : ControllerBase
{
    [HttpGet("amount")]
    public decimal GetAmount(int age, decimal baseAmount)
    {
        return billing.CalculateBilling(age, baseAmount);
    }
}

