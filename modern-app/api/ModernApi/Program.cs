var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<ModernApi.Services.RenewalModule>();
builder.Services.AddSingleton<ModernApi.Services.DiscountModule>();
builder.Services.AddSingleton<ModernApi.Services.BillingCalculator>();
builder.Services.AddSingleton<ModernApi.Services.CreditNoteService>();
builder.Services.AddSingleton<ModernApi.Services.CreditNoteExportService>();

var app = builder.Build();

app.MapControllers();

app.Run();

