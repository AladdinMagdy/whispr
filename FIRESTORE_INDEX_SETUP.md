# Firestore Index Setup

## Required Indexes

The app requires composite indexes for proper functionality. Here are the indexes you need to create:

### 1. Whispers Collection Index

**Purpose**: Support queries that filter by `isPublic` and order by `createdAt`

- **Collection**: `whispers`
- **Fields**:
  - `isPublic` (Ascending)
  - `createdAt` (Descending)

### 2. Replies Collection Index (NEW - Required for Comments)

**Purpose**: Support queries that filter by `whisperId` and order by `createdAt`

- **Collection**: `replies`
- **Fields**:
  - `whisperId` (Ascending)
  - `createdAt` (Descending)

### How to Create the Indexes:

#### Method 1: Manual Creation

1. **Go to Firebase Console**:

   - Visit: https://console.firebase.google.com/
   - Select your project: `whispr-f44f6`

2. **Navigate to Firestore**:

   - Click on "Firestore Database" in the left sidebar
   - Click on the "Indexes" tab

3. **Create Whispers Index**:

   - Click "Create Index"
   - Set the following:
     - **Collection ID**: `whispers`
     - **Fields**:
       - Field: `isPublic`, Order: `Ascending`
       - Field: `createdAt`, Order: `Descending`
   - Click "Create"

4. **Create Replies Index**:

   - Click "Create Index" again
   - Set the following:
     - **Collection ID**: `replies`
     - **Fields**:
       - Field: `whisperId`, Order: `Ascending`
       - Field: `createdAt`, Order: `Descending`
   - Click "Create"

5. **Wait for Indexes to Build**:
   - The indexes will take a few minutes to build
   - You'll see a "Building" status initially
   - Once complete, they will show "Enabled"

#### Method 2: Use Direct Links

You can use these direct links to create the indexes automatically:

**Whispers Index:**

```
https://console.firebase.google.com/project/whispr-f44f6/firestore/indexes?create_composite=Ck1wcm9qZWN0cy93aGlzcHItZjQ0ZjYvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3doaXNwZXJzL2luZGV4ZXMvXxABGgwKCGlzUHVibGljEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg
```

**Replies Index (NEW - Required for Comments):**

```
https://console.firebase.google.com/v1/r/project/whispr-f44f6/firestore/indexes?create_composite=Ckxwcm9qZWN0cy93aGlzcHItZjQ0ZjYvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3JlcGxpZXMvaW5kZXhlcy9fEAEaDQoJd2hpc3BlcklkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg
```

### What These Fixes:

**Whispers Index:**

- **Feed Loading**: The feed will load whispers properly
- **Pagination**: Support for loading more whispers when scrolling
- **Performance**: Faster queries with proper indexing

**Replies Index:**

- **Comment Loading**: Comments will load properly for each whisper
- **Comment Ordering**: Comments will be displayed in chronological order
- **Performance**: Faster comment queries with proper indexing

### Temporary Workaround:

The app includes fallback mechanisms that will work without the indexes, but they're less efficient and don't support pagination properly. Creating the indexes is recommended for the best experience.

### Error Resolution:

If you see an error like:

```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

1. Click on the provided link in the error message
2. Or use the direct links above
3. Wait for the index to build (usually 2-5 minutes)
4. The error should resolve automatically once the index is ready
