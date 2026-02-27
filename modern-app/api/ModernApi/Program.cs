var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();
builder.Services.AddScoped<ModernApi.Services.QuoteService>();
builder.Services.AddScoped<ModernApi.Services.BillingService>();

var app = builder.Build();

app.MapControllers();

app.Run();

