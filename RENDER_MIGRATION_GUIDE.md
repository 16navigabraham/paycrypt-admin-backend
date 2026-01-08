# Running Database Migration on Render

## ✅ Method 1: Automatic on Startup (Free Tier - Recommended)

**The migration now runs automatically when your app starts!**

Just deploy your code and the migration will:
- ✅ Run automatically on every deploy
- ✅ Safe to run multiple times (won't break anything)
- ✅ Fix indexes if they're broken
- ✅ Clean up duplicates if they exist
- ✅ Skip if already fixed

**Steps:**
1. Commit and push your code (see below)
2. Render will auto-deploy
3. Check logs for: `✅ Database migrations completed`

**That's it!** No shell access needed.

---

## Method 2: Using Render Shell (Paid Plans Only)

1. **Open Render Dashboard**
   - Go to https://dashboard.render.com
   - Select your `paycrypt-admin-backend` service

2. **Open Shell**
   - Click on the **"Shell"** tab in the left sidebar
   - Wait for the shell to connect

3. **Run Migration**
   ```bash
   node migrations/fix-syncstatus-index.js
   ```
   Or use the npm script:
   ```bash
   npm run migrate
   ```

4. **Verify Success**
   - Look for: `🎉 Migration completed successfully!`
   - Check that indexes were fixed
   - No error messages should appear

5. **Exit Shell**
   - Type `exit` or close the browser tab

## Method 2: Add as One-Time Job (Alternative)

You can also run this as a one-time job in Render:

1. **Create a new Job** in Render Dashboard
2. **Configure:**
   - Name: `fix-syncstatus-index`
   - Build Command: `npm install`
   - Start Command: `node migrations/fix-syncstatus-index.js`
   - Environment: Use same as your web service
3. **Run Once** and delete the job after completion

## Method 3: Automatic on Deploy (If Needed Repeatedly)

If you want this to run automatically on each deploy (NOT recommended for this one-time fix):

Add to `render.yaml`:
```yaml
services:
  - type: web
    name: paycrypt-admin-backend
    env: node
    buildCommand: npm install && node migrations/fix-syncstatus-index.js
    startCommand: npm start
```

**⚠️ Note:** This is NOT recommended for one-time migrations. Use Method 1 instead.

---

## After Migration

Once migration completes successfully:

### Automatic Redeploy
Your service will automatically redeploy when you push the updated code:

```bash
git add .
git commit -m "Fix: Database index and rate limiting issues"
git push origin main
```

### Monitor Logs
After redeploy, check **Logs** tab in Render for:

✅ **Should see:**
```
✅ MongoDB connected successfully
✅ Contract service initialized for Base (8453)
✅ Contract service initialized for Lisk (1135)
✅ Contract service initialized for Celo (42220)
📊 Found X tokens across all chains
💰 Using cached prices (cache valid)
```

❌ **Should NOT see:**
```
E11000 duplicate key error
Request failed with status code 429
```

---

## Troubleshooting

### Issue: "Cannot find module 'mongoose'"

**Solution:** Run in shell first:
```bash
cd /opt/render/project/src
npm install
node migrations/fix-syncstatus-index.js
```

### Issue: "Connection refused"

**Solution:** Check that `MONGODB_URI` environment variable is set:
```bash
echo $MONGODB_URI
```

If empty, add it in Render Dashboard → Environment → Add Environment Variable

### Issue: Migration fails

**Manual fix via MongoDB Atlas:**
1. Go to MongoDB Atlas dashboard
2. Click "Browse Collections"
3. Find `syncstatuses` collection
4. Click "Indexes" tab
5. Delete `syncType_1` index (if exists)
6. The application will recreate the correct compound index automatically

---

## Environment Variables Check

Ensure these are set in Render Dashboard → Environment:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
BASE_RPC_URL=https://mainnet.base.org
LISK_RPC_URL=https://rpc.api.lisk.com
CELO_RPC_URL=https://forno.celo.org
PRICE_API_URL=https://paycrypt-margin-price.onrender.com
NODE_ENV=production
```

---

## Quick Reference Commands

```bash
# Check if migration is needed
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => mongoose.connection.db.collection('syncstatuses').indexes().then(i => console.log(i)))"

# Run migration
node migrations/fix-syncstatus-index.js

# Check logs after deploy
# (Use Logs tab in Render Dashboard)

# Restart service (if needed)
# (Use Manual Deploy → Clear build cache & deploy in Render Dashboard)
```

---

## Support

If you encounter issues:

1. **Check Render Logs:** Dashboard → Logs tab
2. **Check Migration Output:** Look for specific error messages
3. **Verify Database Connection:** Test MongoDB URI connection
4. **Check Environment Variables:** Ensure all required vars are set

**Render-specific notes:**
- Shell sessions timeout after 30 minutes of inactivity
- Migration should complete in < 1 minute
- No restart needed - service continues running during shell session
