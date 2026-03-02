using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/renewal")]
public class RenewalController(RenewalModule renewal) : ControllerBase
{
    [HttpGet("amount")]
    public decimal GetAmount(int age, decimal baseAmount, int loyaltyYears)
    {
        return renewal.CalculateRenewalAmount(age, baseAmount, loyaltyYears);
    }
}

