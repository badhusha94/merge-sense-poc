var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<ModernApi.Services.RenewalModule>();
builder.Services.AddSingleton<ModernApi.Services.DiscountModule>();
builder.Services.AddSingleton<ModernApi.Services.BillingCalculator>();
builder.Services.AddSingleton<ModernApi.Services.CreditNoteService>();
builder.Services.AddSingleton<ModernApi.Services.CreditNoteExportService>();
builder.Services.AddSingleton<ModernApi.Services.InvoiceAdjustmentService>();

var app = builder.Build();

app.MapControllers();

app.Run();

