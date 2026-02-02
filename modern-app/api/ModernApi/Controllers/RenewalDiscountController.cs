using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RenewalDiscountController : ControllerBase
{
    private readonly RenewalDiscountService _renewalDiscountService;

    public RenewalDiscountController(RenewalDiscountService renewalDiscountService)
    {
        _renewalDiscountService = renewalDiscountService;
    }

    [HttpGet]
    public IActionResult GetRenewalDiscount([FromQuery] decimal amount)
    {
        var discounted = _renewalDiscountService.ApplyRenewalDiscount(amount);
        return Ok(new { original = amount, discounted });
    }
}
