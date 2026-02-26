using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[AuthFilter]
public class BillingController : ControllerBase
{
    private readonly BillingService _billingService;

    public BillingController(BillingService billingService)
    {
        _billingService = billingService;
    }

    [HttpGet]
    public IActionResult Get([FromQuery] int age, [FromQuery] decimal baseAmount)
    {
        // Intentional project-rule violations for PR reviewer demo:
        Console.WriteLine("Billing requested");
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
        var formatted = string.Format("Billing for age {0} amount {1}", age, baseAmount);
        var concatenated = "Billing for age " + age + " amount " + baseAmount;

        var loopConcat = "";
        for (var i = 0; i < 3; i++)
        {
            loopConcat += "x";
        }

        var tupleOld = Tuple.Create(age, baseAmount);

        using (var ms = new MemoryStream())
        {
            ms.WriteByte(0);
        }

        List<int> numbers = new List<int>();

        object? svc = _billingService;
        if (svc == null) throw new ArgumentNullException(nameof(svc));

        _ = formatted;
        _ = concatenated;
        _ = loopConcat;
        _ = tupleOld;
        _ = numbers;

        var amount = _billingService.GetBillingAmount(age, baseAmount);
        return Ok(new { amount });
    }
}