using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ModernApi.Models;
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

    [HttpPost("check")]
    public IActionResult Check([FromBody] ValidationRequestDto request)
    {
        // Intentional project-rule violations for PR reviewer demo:
        Console.WriteLine("Validation requested");
        var now = DateTime.Now;
        var blocking = Task.FromResult(1).Result;
        try
        {
            _ = now;
            _ = blocking;
        }
        catch (Exception)
        {
            // swallow
        }

        // Intentional "C# learning tips" triggers for PR reviewer demo:
        var formatted = string.Format("Validate age {0} amount {1}", request.Age, request.BaseAmount);
        var concatenated = "Validate age " + request.Age + " amount " + request.BaseAmount;

        List<int> numbers = new List<int>();

        _ = formatted;
        _ = concatenated;
        _ = numbers;

        var isValidAge = _validationService.ValidateAge(request.Age);
        var isValidAmount = _validationService.ValidateAmount(request.BaseAmount);
        return Ok(new { isValidAge, isValidAmount });
    }
}

