using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/v1/premium")]
public class PremiumController(PremiumCalculator premium) : ControllerBase
{
    [HttpGet("amount")]
    public decimal GetAmount(int age, decimal baseAmount)
    {
        return premium.CalculatePremium(age, baseAmount);
    }
}