# 🚀 Deployment Guide: Vercel (Frontend) & Render (Backend)

This repository is pre-configured for seamless deployment of the **Frontend to Vercel** and the **Backend to Render**.

---

## 1. Push to GitHub

Initialize and push your repository to GitHub:

```bash
# In the project root
git add .
git commit -m "feat: complete reachinbox cold email scheduler with vercel & render deployment configs"

# Add your GitHub repository remote
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git branch -M main
git push -u origin main
```

---

## 2. Deploy Backend on Render

### Option A: Using Render Blueprint (Automatic `render.yaml`)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically parse `render.yaml` and provision:
   - **PostgreSQL Database** (`reachinbox-postgres`)
   - **Backend Web Service** (`reachinbox-backend`)
5. Click **Apply**.

---

### Option B: Manual Web Service on Render
1. Click **New +** → **Web Service**.
2. Select your repository.
3. Configure the following fields:
   - **Name**: `reachinbox-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx prisma db push && npm start`
4. Add **Environment Variables** in Render:
   | Key | Value / Description |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `FRONTEND_URL` | `https://<YOUR_APP>.vercel.app` *(Your Vercel URL)* |
   | `DATABASE_URL` | Your PostgreSQL connection string *(Render Postgres, Supabase, Neon, or Aiven)* |
   | `REDIS_URL` | Your Redis connection string *(Render Redis, Upstash, or Redis Cloud)* |
   | `JWT_SECRET` | A secure random string (e.g. `super-secret-reachinbox-jwt-key-2025`) |
   | `GOOGLE_CLIENT_ID` | *(Optional)* Your Google OAuth Client ID |
   | `GOOGLE_CLIENT_SECRET` | *(Optional)* Your Google OAuth Client Secret |
   | `SLACK_CLIENT_ID` | *(Optional)* Your Slack Client ID |
   | `SLACK_CLIENT_SECRET` | *(Optional)* Your Slack Client Secret |
   | `SLACK_REDIRECT_URI` | `https://<YOUR_BACKEND>.onrender.com/api/slack/oauth_redirect` |

> 💡 **Redis Free Tier Tip**: If using Upstash Redis for free serverless Redis, grab the `rediss://default:xxx@xxx.upstash.io:6379` URI and paste it directly into `REDIS_URL`.

---

## 3. Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your GitHub repository.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: `npm run build` *(default)*
   - **Output Directory**: `dist` *(default)*
4. Expand **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<YOUR_RENDER_BACKEND>.onrender.com/api` |
   | `VITE_BULL_BOARD_URL` | `https://<YOUR_RENDER_BACKEND>.onrender.com/admin/queues` |
   | `VITE_GOOGLE_CLIENT_ID` | *(Optional)* Your Google OAuth Client ID |
5. Click **Deploy**.

---

## 4. Post-Deployment Verification Checklist

- [ ] Open your Vercel URL in your browser.
- [ ] Log in via Google OAuth or 1-Click Instant Demo Access.
- [ ] Upload `sample_emails.csv` in the Compose modal — verify all 20 leads autofill without attaching the file.
- [ ] Send / schedule a test batch and verify delivery status & charts in the dashboard.
