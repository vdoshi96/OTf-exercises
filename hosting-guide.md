# Hosting Guide — OTF Exercise Directory

Step-by-step instructions to deploy the exercise directory to the internet.

---

## Prerequisites

Make sure these are installed on your Mac:

```bash
# Check Node.js (need v18+)
node --version

# If not installed or outdated:
brew install node

# Check git
git --version
```

You'll also need:
- A GitHub account (github.com)
- A Vercel account (vercel.com) — sign up with GitHub, it's free

---

## Step 1: Push the Project to GitHub

Once Claude Code finishes building the project:

```bash
cd otf-exercise-directory

# Initialize git repo
git init
git add .
git commit -m "Initial commit: OTF exercise directory"

# Create a repo on GitHub (use GitHub CLI or do it on github.com)
# If you have GitHub CLI:
brew install gh
gh auth login
gh repo create otf-exercise-directory --public --source=. --push

# If you don't have GitHub CLI, create the repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/otf-exercise-directory.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (easiest)

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Import your `otf-exercise-directory` repository
4. Vercel auto-detects Next.js — leave all settings as defaults
5. Click "Deploy"
6. Wait ~60 seconds. You'll get a live URL like `otf-exercise-directory.vercel.app`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
cd otf-exercise-directory
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: otf-exercise-directory
# - Directory: ./
# - Override settings? No

# For production deployment:
vercel --prod
```

---

## Step 3: Custom Domain (Optional, ~$10–15/year)

If you want a clean URL like `otfexercises.com`:

1. Buy a domain from Namecheap, Cloudflare Registrar, or Google Domains
   - Cloudflare Registrar is cheapest (at-cost pricing, ~$10/year for .com)
   - Go to https://dash.cloudflare.com → "Register Domains"

2. In Vercel dashboard:
   - Go to your project → Settings → Domains
   - Type your domain name and click "Add"
   - Vercel gives you DNS records to add

3. In your domain registrar's DNS settings, add:
   - `A` record: `76.76.21.21`
   - `CNAME` record for `www`: `cname.vercel-dns.com`

4. Wait 5–30 minutes for DNS propagation. Vercel auto-provisions HTTPS.

---

## Step 4: Updating the Site

When you add new exercises or make changes:

```bash
cd otf-exercise-directory

# Make your changes, then:
git add .
git commit -m "Add new exercises from March 2026"
git push origin main
```

Vercel automatically redeploys on every push to `main`. Your site updates within ~60 seconds.

---

## Step 5: Monitoring

Vercel free tier includes:
- 100 GB bandwidth/month (more than enough for a static-ish site)
- Serverless function invocations if you add any API routes
- Analytics (basic, under Settings → Analytics)

Check usage at: https://vercel.com/dashboard → your project → Usage

You won't hit any limits unless the site goes viral. If it does, Vercel Pro is $20/month with much higher limits.

---

## Troubleshooting

**Build fails on Vercel:**
Run `npm run build` locally first to catch errors before pushing.

**TikTok embeds not loading:**
TikTok embeds require their JS script (`tiktok.com/embed.js`). If they break, the fallback link to the original TikTok should still work. Check the browser console for errors.

**yt-dlp can't scrape TikTok:**
TikTok blocks scrapers frequently. Try updating yt-dlp (`pip install -U yt-dlp`). If it still fails, manually collect video URLs from his profile page and put them in `urls.txt`.

**Want to move off Vercel later?**
Since this is a standard Next.js app, it deploys anywhere: Netlify, Cloudflare Pages, AWS Amplify, or even a $5 VPS with `npm run build && npm start`.

---

## Cost Summary

| Item | Monthly | Annual |
|---|---|---|
| Vercel hosting | $0 | $0 |
| Domain (optional) | — | $10–15 |
| Cloudflare DNS (if using CF registrar) | $0 | $0 |
| **Total** | **$0** | **$0–15** |
