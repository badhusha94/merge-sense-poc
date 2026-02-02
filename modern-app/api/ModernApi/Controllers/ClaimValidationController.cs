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
        if (age < 0 || age > 120)
        {
            return BadRequest("Age must be between 0 and 120.");
        }
        return Validate(age, _claimValidationService.IsAgeValid);
    }

    [HttpGet("amount")]
    public IActionResult ValidateAmount([FromQuery] decimal amount)
    {
        if (amount < 0)
        {
            return BadRequest("Amount must be a positive value.");
        }
        return Validate(amount, _claimValidationService.IsAmountValid);
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

    [HttpGet("validate")]
    public IActionResult ValidateAgeAndAmount([FromQuery] int age, [FromQuery] decimal amount)
    {
        IActionResult ageResult = ValidateAge(age);
        if (ageResult is BadRequestObjectResult)
        {
            return ageResult;
        }
        
        IActionResult amountResult = ValidateAmount(amount);
        if (amountResult is BadRequestObjectResult)
        {
            return amountResult;
        }

        var ageValid = _claimValidationService.IsAgeValid(age);
        var amountValid = _claimValidationService.IsAmountValid(amount);

        // Changed this line to use the correct validation logic
        return OkResponse(new { age, amount }, ageValid && amountValid);
    }
}