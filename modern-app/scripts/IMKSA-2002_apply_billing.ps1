# Developer: CodeReviewAgentPOC

param(
  [Parameter(Mandatory = $true)]
  [int]$Age,

  [Parameter(Mandatory = $true)]
  [decimal]$BaseAmount
)

Write-Output ("Age={0} BaseAmount={1}" -f $Age, $BaseAmount)

