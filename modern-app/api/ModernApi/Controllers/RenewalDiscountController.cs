using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/renewal-discount")]
public class RenewalDiscountController(RenewalDiscountModule discounts) : ControllerBase
{
    [HttpGet("percent")]
    public decimal GetPercent(int loyaltyYears)
    {
        return discounts.GetRenewalDiscountPercent(loyaltyYears);
    }

    [HttpGet("apply")]
    public decimal Apply(decimal amount, int loyaltyYears)
    {
        return discounts.ApplyRenewalDiscount(amount, loyaltyYears);
    }
}

