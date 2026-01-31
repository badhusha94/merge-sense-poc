var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddScoped<ModernApi.Services.PremiumService>();

var app = builder.Build();
app.MapControllers();
app.Run();
