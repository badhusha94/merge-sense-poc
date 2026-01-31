using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiscountController : ControllerBase
{
    private readonly DiscountService _discountService;

    public DiscountController(DiscountService discountService)
    {
        _discountService = discountService;
    }

    [HttpGet]
    public IActionResult GetDiscountedAmount([FromQuery] decimal amount)
    {
        var discounted = _discountService.ApplyDiscount(amount);
        return Ok(new { original = amount, discounted });
    }
}
