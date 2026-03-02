# Developer: CodeReviewAgentPOC

param(
  [Parameter(Mandatory = $true)]
  [decimal]$Amount,

  [Parameter(Mandatory = $true)]
  [int]$LoyaltyYears
)

Write-Output ("Amount={0} LoyaltyYears={1}" -f $Amount, $LoyaltyYears)

