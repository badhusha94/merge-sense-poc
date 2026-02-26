Legacy App (intentionally redundant)

This folder contains a small set of "legacy" business modules meant to be migrated into `modern-app/api/ModernApi/` later.

Important: The code here intentionally includes:
- semantic duplication (same business formula implemented in multiple modules)
- redundant constants and helper methods
- slight edge-case drift (e.g., `>=` vs `>`) to trigger AI review findings

Modules (at least 5):
- Quote module
- Premium module
- Billing module
- Validation module
- Discount module
- Renewal module

