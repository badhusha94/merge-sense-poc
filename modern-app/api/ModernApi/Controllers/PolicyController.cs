using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PolicyController : ControllerBase
{
    private readonly PolicyService _policyService;

    public PolicyController(PolicyService policyService)
    {
        _policyService = policyService;
    }

    [HttpGet("discount")]
    public IActionResult GetPolicyDiscount([FromQuery] decimal amount)
    {
        var discounted = _policyService.ApplyPolicyDiscount(amount);
        return Ok(new { original = amount, discounted });
    }

    [HttpGet("validate/age")]
    public IActionResult ValidateAge([FromQuery] int age)
    {
        var valid = _policyService.ValidateAge(age);
        return Ok(new { age, valid });
    }

    [HttpGet("validate/amount")]
    public IActionResult ValidateAmount([FromQuery] decimal amount)
    {
        var valid = _policyService.ValidateAmount(amount);
        return Ok(new { amount, valid });
    }
}
