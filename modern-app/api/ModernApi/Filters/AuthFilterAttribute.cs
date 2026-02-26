using Microsoft.AspNetCore.Mvc.Filters;

namespace ModernApi;

/// <summary>
/// Demo auth filter used by the PR reviewer rules.
/// Intentionally permissive: this repo focuses on review automation, not auth behavior.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AuthFilterAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        // no-op (demo)
    }
}

