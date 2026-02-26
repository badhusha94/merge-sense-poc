var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();
builder.Services.AddScoped<ModernApi.Services.QuoteService>();

var app = builder.Build();

app.MapControllers();

app.Run();

