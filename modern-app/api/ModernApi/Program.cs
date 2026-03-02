var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();
builder.Services.AddScoped<ModernApi.Services.QuoteService>();
builder.Services.AddScoped<ModernApi.Services.BillingService>();
builder.Services.AddScoped<ModernApi.Services.ValidationService>();
builder.Services.AddScoped<ModernApi.Services.RenewalService>();
builder.Services.AddScoped<ModernApi.Services.PolicyPricingService>();

var app = builder.Build();

app.MapControllers();

app.Run();

