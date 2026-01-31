using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ValidationController : ControllerBase
{
    private readonly ValidationService _validationService;

    public ValidationController(ValidationService validationService)
    {
        _validationService = validationService;
    }

    [HttpGet("age")]
    public IActionResult ValidateAge([FromQuery] int age)
    {
        var valid = _validationService.ValidateAge(age);
        return Ok(new { age, valid });
    }

    [HttpGet("amount")]
    public IActionResult ValidateAmount([FromQuery] decimal amount)
    {
        var valid = _validationService.ValidateAmount(amount);
        return Ok(new { amount, valid });
    }
}
