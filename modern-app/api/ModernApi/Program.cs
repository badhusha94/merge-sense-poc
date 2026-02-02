var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();
builder.Services.AddScoped<ModernApi.Services.BillingService>();
builder.Services.AddScoped<ModernApi.Services.DiscountService>();
builder.Services.AddScoped<ModernApi.Services.ValidationService>();
builder.Services.AddScoped<ModernApi.Services.RenewalService>();
builder.Services.AddScoped<ModernApi.Services.QuoteService>();
builder.Services.AddScoped<ModernApi.Services.ClaimsService>();
builder.Services.AddScoped<ModernApi.Services.PolicyService>();
builder.Services.AddScoped<ModernApi.Services.RenewalDiscountService>();
builder.Services.AddScoped<ModernApi.Services.ClaimValidationService>();

var app = builder.Build();
app.MapControllers();
app.Run();
