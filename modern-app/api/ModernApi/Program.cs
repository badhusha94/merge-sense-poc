var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<ModernApi.Services.RenewalModule>();

var app = builder.Build();

app.MapControllers();

app.Run();

