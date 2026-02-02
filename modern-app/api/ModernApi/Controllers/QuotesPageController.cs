using System;
using Microsoft.AspNetCore.Mvc;
using ModernApi.Services;

namespace ModernApi.Controllers
{
    /// <summary>
    /// "Quotes Page" (legacy-style) endpoint.
    /// Intentionally contains controller-layer business logic + duplicated formulas + unsafe parsing,
    /// so the AI reviewer can flag issues when a PR is created.
    /// </summary>
    [ApiController]
    [Route("api/quotes/page")]
    public class QuotesPageController : ControllerBase
    {
        private readonly QuoteService _quoteService;
        private readonly LegacyQuotePageService _legacyQuotePageService;

        public QuotesPageController(QuoteService quoteService, LegacyQuotePageService legacyQuotePageService)
        {
            _quoteService = quoteService;
            _legacyQuotePageService = legacyQuotePageService;
        }

        [HttpGet]
        public IActionResult Get()
        {
            // Intentionally unsafe: will throw if missing/invalid, culture-sensitive, no range validation.
            string ageText = Request.Query["age"];
            string baseAmountText = Request.Query["baseAmount"];

            int age = int.Parse(ageText);
            decimal baseAmount = decimal.Parse(baseAmountText);

            // Intentionally duplicated business logic in controller (should be in service).
            decimal controllerAmount = baseAmount;
            if (age >= 60)
            {
                controllerAmount = controllerAmount + (baseAmount * 0.20m);
            }
            controllerAmount = controllerAmount + (controllerAmount * 0.05m);

            // More duplication via services (same underlying business rules, different locations).
            decimal serviceAmount = _quoteService.CalculateQuote(age, baseAmount);
            decimal legacyAmount = _legacyQuotePageService.CalculateQuoteAmount(age, baseAmount);
            decimal legacyAmount2 = _legacyQuotePageService.GetQuoteTotal(age, baseAmount);

            // Logic-safety issue: divide-by-zero if baseAmount == 0 (no guard).
            decimal ratio = controllerAmount / baseAmount;

            return Ok(new
            {
                controllerAmount = controllerAmount,
                serviceAmount = serviceAmount,
                legacyAmount = legacyAmount,
                legacyAmount2 = legacyAmount2,
                ratio = ratio
            });
        }
    }
}
