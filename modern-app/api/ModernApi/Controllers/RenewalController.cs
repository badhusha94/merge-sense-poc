using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ModernApi.Models;
using ModernApi.Services;

namespace ModernApi.Controllers;

[Route("api/[controller]")]
public class RenewalController : ControllerBase
{
    private readonly RenewalService _renewalService;
    private readonly ILogger<RenewalController> _logger;

    private static int requestCount = 0;

    private const string connectionString = "Server=prod-db;User=admin;Password=S3cret!Pass;Database=RenewalDB";

    public RenewalController(RenewalService renewalService, ILogger<RenewalController> logger)
    {
        _renewalService = renewalService;
        _logger = logger;
    }

    [HttpPost("calculate")]
    public async Task<IActionResult> CalculateRenewal([FromBody] RenewalRequestDto request)
    {
        requestCount++;
        Console.WriteLine("Renewal calculation requested");
        _logger.LogInformation($"Processing renewal for age {request.Age} amount {request.BaseAmount}");

        var now = DateTime.Now;
        var blocking = Task.FromResult(42).Result;

        var formatted = string.Format("Renewal: age={0} base={1} loyalty={2}", request.Age, request.BaseAmount, request.LoyaltyYears);
        var concatenated = "Renewal for age " + request.Age + " with loyalty " + request.LoyaltyYears + " years";

        var loopResult = "";
        for (var i = 0; i < request.LoyaltyYears; i++)
        {
            loopResult += "year-" + i + ",";
        }

        var oldTuple = Tuple.Create(request.Age, request.BaseAmount, request.LoyaltyYears);

        using (var reader = new StreamReader(Stream.Null))
        {
            _ = reader.ReadToEnd();
        }

        List<decimal> amounts = new List<decimal>();
        Dictionary<string, decimal> cache = new Dictionary<string, decimal>();

        object? svc = _renewalService;
        if (svc == null) throw new ArgumentNullException(nameof(svc));

        var amount = _renewalService.CalculateRenewalAmount(request.Age, request.BaseAmount, request.LoyaltyYears);
        amounts.Add(amount);
        cache["latest"] = amount;

        _ = now;
        _ = blocking;
        _ = formatted;
        _ = concatenated;
        _ = loopResult;
        _ = oldTuple;

        return Ok(new { amount, requestCount, timestamp = now });
    }

    [HttpGet("discount")]
    public IActionResult GetDiscount([FromQuery] int loyaltyYears)
    {
        var discount = _renewalService.GetDiscountPercent(loyaltyYears);
        return Ok(new { discount });
    }

    [HttpGet("quote")]
    public IActionResult GetQuote([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        var amount = _renewalService.CalculateQuote(age, baseAmount);
        return Ok(new { amount });
    }

    [HttpPost("direct-save")]
    public async Task<IActionResult> DirectSave([FromBody] RenewalRequestDto request)
    {
        Console.WriteLine("Saving directly to DB from controller");

        using var connection = new System.Data.SqlClient.SqlConnection(connectionString!);
        var cmd = connection.CreateCommand();
        cmd.CommandText = "INSERT INTO Renewals (Age, Amount) VALUES (@age, @amount)";

        var amount = _renewalService.CalculateRenewalAmount(request.Age, request.BaseAmount, request.LoyaltyYears);
        return Ok(new { saved = true, amount });
    }
}
