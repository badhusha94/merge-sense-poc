using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/discount")]
public class DiscountController(DiscountModule discounts) : ControllerBase
{
    [HttpGet("percent")]
    public decimal GetPercent(int loyaltyYears)
    {
        return discounts.GetDiscountPercent(loyaltyYears);
    }

    [HttpGet("apply")]
    public decimal Apply(decimal amount, int loyaltyYears)
    {
        return discounts.ApplyDiscount(amount, loyaltyYears);
    }
}

