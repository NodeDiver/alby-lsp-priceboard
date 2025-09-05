# Deployment Guide - Alby LSP Price Board

## 🚀 Deploy to Vercel

### Prerequisites
- Vercel account (free tier available)
- GitHub repository with this code

### Step 1: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your GitHub repository

### Step 2: Configure Vercel KV
1. In your Vercel project dashboard, go to "Storage"
2. Click "Create Database"
3. Choose "KV" (Redis)
4. Select your preferred region
5. Click "Create"

### Step 3: Set Environment Variables
In your Vercel project settings, add these environment variables:

```bash
KV_URL=your_kv_url_here
KV_REST_API_URL=your_kv_rest_url_here
KV_REST_API_TOKEN=your_kv_token_here
KV_REST_API_READ_ONLY_TOKEN=your_readonly_token_here
```

### Step 4: Deploy
1. Vercel will automatically detect Next.js
2. Click "Deploy"
3. Wait for build to complete

### Step 5: Configure Custom Domain (Optional)
1. Go to "Domains" in project settings
2. Add your custom domain
3. Follow DNS configuration instructions

## 🐳 Deploy with Docker

### Build Image
```bash
docker build -t alby-lsp-priceboard .
```

### Run Container
```bash
docker run -p 3000:3000 alby-lsp-priceboard
```

## 📊 Verify Deployment

1. Check your deployed URL
2. Test the API endpoints:
   - `GET /api/prices` - Should return LSP prices
   - `GET /api/debug` - Should show system status
3. Verify cron job is working (check Vercel logs)

## 🔧 Troubleshooting

### Common Issues
- **Build fails**: Check Node.js version compatibility
- **API errors**: Verify environment variables are set
- **Cron job not working**: Check Vercel KV configuration

### Support
- Check Vercel deployment logs
- Verify environment variables
- Test locally first
