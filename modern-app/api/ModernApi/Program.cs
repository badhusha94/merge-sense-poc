var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<ModernApi.Services.RenewalModule>();
builder.Services.AddSingleton<ModernApi.Services.DiscountModule>();
builder.Services.AddSingleton<ModernApi.Services.RenewalDiscountModule>();

var app = builder.Build();

app.MapControllers();

app.Run();

