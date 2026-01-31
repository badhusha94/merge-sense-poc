using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClaimValidationController : ControllerBase
{
    private readonly ClaimValidationService _claimValidationService;

    public ClaimValidationController(ClaimValidationService claimValidationService)
    {
        _claimValidationService = claimValidationService;
    }

    [HttpGet("age")]
    public IActionResult ValidateAge([FromQuery] int age)
    {
        var valid = _claimValidationService.IsValidAge(age);
        return Ok(new { age, valid });
    }

    [HttpGet("amount")]
    public IActionResult ValidateAmount([FromQuery] decimal amount)
    {
        var valid = _claimValidationService.IsValidAmount(amount);
        return Ok(new { amount, valid });
    }
}
