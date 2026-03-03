using Microsoft.AspNetCore.Mvc.Filters;

namespace ModernApi;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AuthFilterAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
    }
}
