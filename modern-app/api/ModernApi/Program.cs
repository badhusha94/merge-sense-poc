var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();
builder.Services.AddScoped<ModernApi.Services.BillingService>();
builder.Services.AddScoped<ModernApi.Services.DiscountService>();
builder.Services.AddScoped<ModernApi.Services.ValidationService>();

var app = builder.Build();
app.MapControllers();
app.Run();
