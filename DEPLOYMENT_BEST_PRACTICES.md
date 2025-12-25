# Deployment Best Practices

## Preventing Multiple Concurrent Deployments

### The Problem
When you push multiple commits quickly, Vercel triggers a deployment for each commit, causing multiple builds to run simultaneously.

### Solutions

#### 1. Configure Vercel Project Settings (Recommended)
1. Go to Vercel Dashboard → Your Project → Settings
2. Navigate to **Build and Deployment** section
3. Under **On-Demand Concurrent Builds**, select:
   - **"Run up to one build per branch"** - Limits to one deployment per branch
4. Save changes

This ensures only one deployment runs at a time per branch.

#### 2. Squash Commits Before Pushing
Instead of pushing multiple small commits, combine them:

```bash
# Interactive rebase to squash last 2 commits
git rebase -i HEAD~2

# In the editor, change 'pick' to 'squash' for the second commit
# Save and close, then push
git push origin main --force-with-lease
```

#### 3. Use `git commit --amend` for Follow-up Fixes
If you need to fix something immediately after a commit:

```bash
# Make your changes
git add .
git commit --amend --no-edit  # Amends previous commit without changing message
git push origin main --force-with-lease
```

#### 4. Wait for Deployment to Complete
Before pushing another commit, wait for the current deployment to finish. Check Vercel dashboard or use:

```bash
# Check deployment status via Vercel CLI
vercel ls
```

### Best Practices

1. **Batch Related Changes**: Group related fixes into a single commit
2. **Test Locally First**: Run `npm run build` locally before pushing
3. **Use Meaningful Commit Messages**: One clear commit per logical change
4. **Monitor Deployments**: Don't push new commits while a deployment is building

### Current Configuration

- `vercel.json` is configured for Next.js
- Build command: `npm run build`
- Framework: Next.js (auto-detected)

### When Multiple Deployments Are OK

- Different branches (main, develop, feature branches)
- Different environments (production, preview, development)
- Manual deployments vs automatic deployments

