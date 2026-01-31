# Legacy App — Duplication Examples for AI PR Review

This folder contains **intentionally redundant** code so the AI reviewer can catch semantic duplication and logic drift when two developers migrate different modules to the modern API in separate feature branches.

## AI Reviewer Categories & Example Code

| Category | What the reviewer catches | Legacy modules with that pattern |
|----------|----------------------------|-----------------------------------|
| **Semantic duplication** | Same business logic in different methods/files | PremiumPage.CalculatePremium, RenewalPage.ComputeRenewalPremium, BillingModule.GetBillingAmount, QuotePage.CalculateQuote, ClaimsPage.CalculateClaimAmount — all implement age loading + tax. DiscountHelper.ApplyDiscount, PolicyPage.ApplyPolicyDiscount, RenewalDiscountHelper.ApplyRenewalDiscount — same 10% above 1000. ValidationHelper.ValidateAge/ValidateAmount, PolicyPage.ValidateAge/ValidateAmount, ClaimValidation.IsValidAge/IsValidAmount — same rules. |
| **Logic safety** | Modified method changes rules (e.g. age threshold) | RenewalPage/QuotePage use `age >= 60`, others use `age > 60` — subtle drift. When migrated, if one branch changes threshold, logic-safety check flags it. |
| **Redundant constants** | Same values scattered across files | TAX_RATE / QuoteTaxRate / RenewalTaxRate / ClaimTaxRate (0.05), AGE_LOADING_THRESHOLD / SeniorAgeThreshold / AgeLoadingCutoff (60), LOADING_PERCENT / LoadingRate (0.20), DISCOUNT_THRESHOLD / PolicyDiscountThreshold (1000), DISCOUNT_PERCENT (0.10). |
| **Redundant methods/variables** | Duplicate helpers across modules | Multiple “premium/quote/claim” calculations; multiple discount helpers; multiple validation helpers. |

## Two-Developer Migration Test

1. **Developer A (Cursor instance 1)** — Migrate “premium/billing” side:
   - PremiumPage, BillingModule → e.g. `PremiumService`, `BillingService` in modern-app
   - DiscountHelper, ValidationHelper → e.g. `DiscountService`, `ValidationService`
   - Create PR from branch `feature/migrate-premium-billing`

2. **Developer B (Cursor instance 2)** — Migrate “renewal/quote/claims” side:
   - RenewalPage, QuotePage, ClaimsPage → e.g. `RenewalService`, `QuoteService`, `ClaimsService`
   - PolicyPage, RenewalDiscountHelper, ClaimValidation → e.g. policy/discount/validation in modern-app
   - Create PR from branch `feature/migrate-renewal-quote-claims`

3. **Merge or combine** both branches into one PR (or merge one into the other). The PR will contain:
   - Multiple services with similar methods (CalculatePremium, GetBillingAmount, CalculateQuote, CalculateClaimAmount, etc.)
   - Multiple discount/validation implementations

4. **Run AI review** (GitHub Action on `modern-app/api/**`). Expect:
   - **Semantic duplicate** findings: e.g. “This method appears to duplicate logic from BillingService.GetBillingAmount”
   - **Logic safety** findings if age threshold or formula differs between migrated methods

## File Map (Developer A vs B)

| Developer A | Developer B |
|-------------|-------------|
| PremiumPage.aspx.cs | RenewalPage.aspx.cs |
| BillingModule.cs | QuotePage.aspx.cs |
| DiscountHelper.cs | PolicyPage.aspx.cs, RenewalDiscountHelper.cs |
| ValidationHelper.cs | ClaimValidation.cs |
| — | ClaimsPage.aspx.cs |

All of the above contain overlapping logic, constants, or validation so the reviewer has clear examples for each category.
