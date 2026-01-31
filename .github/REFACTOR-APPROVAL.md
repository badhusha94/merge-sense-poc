# Human approval for AI refactor

The **AI Apply Refactor** workflow runs when someone comments `/ai-apply-refactor` on a PR.  
The workflow **waits for a human to approve** before it changes any code.

## Setup (one-time)

1. **Create the environment**
   - Repo → **Settings** → **Environments** → **New environment**
   - Name: **`refactor-approval`** (must match the workflow)
   - Click **Configure environment**

2. **Require a reviewer**
   - Under **Required reviewers**, add **1** (or more) people/teams
   - Save

After this, when someone comments `/ai-apply-refactor` on a PR:

1. The workflow runs and the **apply** job shows **“Waiting for approval”**.
2. A required reviewer goes to **Actions** → run **“AI Apply Refactor”** → **Review pending deployments** and approves.
3. The job then runs: re-runs the AI review to get findings, applies refactors via AI, commits, pushes to the PR branch.
4. The AI review workflow runs again on the new commit (checks re-run).
5. A comment is posted: **“Refactor applied. Please test locally and run your tests before merging.”**

No code is changed until a human approves the deployment for the **refactor-approval** environment.
