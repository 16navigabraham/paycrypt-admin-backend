# Database Migrations

This directory contains database migration scripts to fix issues and update schemas.

## Available Migrations

### fix-syncstatus-index.js

**Purpose:** Fixes the duplicate key error in SyncStatus collection caused by incorrect index.

**Issue:** 
```
MongoServerError: E11000 duplicate key error collection: test.syncstatuses 
index: syncType_1 dup key: { syncType: "metrics" }
```

**What it does:**
1. Removes the old unique index on `syncType` alone
2. Ensures the correct compound unique index on `syncType + chainId` exists
3. Removes any duplicate documents that may have been created

**How to run:**

```bash
# From the project root directory
node migrations/fix-syncstatus-index.js
```

**When to run:**
- If you see duplicate key errors related to `syncstatuses` collection
- After upgrading to multi-chain support if you had existing data
- One-time migration (safe to run multiple times)

**Output:**
```
🚀 Starting SyncStatus index migration...
🔗 Connecting to MongoDB...
✅ Connected to MongoDB
📋 Current indexes:
  - _id_: {"_id":1}
  - syncType_1: {"syncType":1}
⚠️  Found old syncType_1 index (without chainId)
🗑️  Dropping old index...
✅ Successfully dropped old index
🔧 Ensuring correct compound index exists...
✅ Compound index ensured
📋 Final indexes:
  - _id_: {"_id":1}
  - syncType_1_chainId_1: {"syncType":1,"chainId":1}
🔍 Checking for duplicate documents...
✅ No duplicate documents found
🎉 Migration completed successfully!
```

## General Migration Best Practices

1. **Backup First:** Always backup your database before running migrations
2. **Stop Services:** Stop your application before running migrations
3. **Test Environment:** Test migrations in a staging environment first
4. **Review Logs:** Check the migration output for any errors or warnings
5. **Restart Application:** Restart your application after successful migration

## Environment Variables

Migrations use the same `.env` file as your main application:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```
