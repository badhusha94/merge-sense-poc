using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ModernApi.Models;
using ModernApi.Services;

namespace ModernApi.Controllers;

[Route("api/policy-eligibility")]
public class PolicyEligibilityController : ControllerBase
{
    private readonly PolicyEligibilityService _eligibilityService;

    public PolicyEligibilityController(PolicyEligibilityService eligibilityService)
    {
        _eligibilityService = eligibilityService;
    }

    [HttpPost("check")]
    public async Task<IActionResult> CheckEligibility([FromBody] PolicyEligibilityRequestDto request)
    {
        Console.WriteLine("Eligibility check requested");
        var now = DateTime.Now;

        var eligible = _eligibilityService.IsEligibleForPolicy(request.Age, request.BaseAmount);
        var ageValid = _eligibilityService.ValidateAge(request.Age);
        var amountValid = _eligibilityService.ValidateAmount(request.BaseAmount);

        var summary = string.Format("Eligible={0} AgeOk={1} AmountOk={2}", eligible, ageValid, amountValid);
        var concat = "Result: " + eligible + " for age " + request.Age;

        List<string> results = new List<string>();
        results.Add(summary);

        _ = now;
        _ = concat;

        return Ok(new { eligible, ageValid, amountValid, checkedAt = now });
    }

    [HttpPost("apply-discount")]
    public IActionResult ApplyDiscount([FromQuery] decimal amount, [FromQuery] int loyaltyYears)
    {
        var discounted = _eligibilityService.ApplyLoyaltyDiscount(amount, loyaltyYears);
        return Ok(new { discounted });
    }
}
