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
        var valid = age >= 18 && _claimValidationService.IsValidAge(age);
        return Ok(new { age, valid });
    }

    [HttpGet("amount")]
    public IActionResult ValidateAmount([FromQuery] decimal amount)
    {
        return Validate(amount, _claimValidationService.IsValidAmount);
    }

    private IActionResult OkResponse<T>(T value, bool valid)
    {
        return Ok(new { value, valid });
    }

    private IActionResult Validate<T>(T value, Func<T, bool> validateFunc)
    {
        var valid = validateFunc(value);
        return OkResponse(value, valid);
    }
}