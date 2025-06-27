# Environment Setup Guide

## 🔧 **Expo Environment Variables Best Practices**

### **Required Prefix: `EXPO_PUBLIC_`**

In Expo SDK 49+, **all client-side environment variables must start with `EXPO_PUBLIC_`**.

- ✅ **Client-side variables** (accessible in your app): `EXPO_PUBLIC_FIREBASE_API_KEY`
- ❌ **Server-side variables** (only in Node.js): Can use any name

## 📁 **Environment Files Structure**

### **1. Development (`.env`)**

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id

# OpenAI Configuration
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key

# App Configuration
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_ENABLE_TRANSCRIPTION=true
EXPO_PUBLIC_ENABLE_VOLUME_DETECTION=true
EXPO_PUBLIC_MAX_AUDIO_DURATION=30
EXPO_PUBLIC_WHISPER_VOLUME_THRESHOLD=0.4
```

### **2. Staging (`.env.staging`)**

```bash
# Same structure as .env but with staging values
EXPO_PUBLIC_APP_ENV=staging
EXPO_PUBLIC_FIREBASE_PROJECT_ID=project_ID
# ... other staging-specific values
```

### **3. Production (`.env.production`)**

```bash
# Same structure as .env but with production values
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_FIREBASE_PROJECT_ID=project_ID
# ... other production-specific values
```

## 🚀 **How to Use Different Environments**

### **Development**

```bash
# Uses .env by default
expo start
```

### **Staging**

```bash
# Load staging environment
EXPO_PUBLIC_APP_ENV=staging expo start
```

### **Production**

```bash
# Load production environment
EXPO_PUBLIC_APP_ENV=production expo start
```

## 🔒 **Security Best Practices**

### **1. Never Commit Sensitive Files**

```bash
# .gitignore should include:
.env
.env.local
.env.production
.env.staging
```

### **2. Use Environment-Specific Firebase Projects**

- **Development**: `whispr-dev`
- **Staging**: `whispr-staging`
- **Production**: `whispr-production`

### **3. API Key Rotation**

- Rotate OpenAI API keys regularly
- Use different Firebase projects for different environments
- Monitor API usage and costs

## 🔄 **The app will automatically use the new configuration** through our `src/config/environment.ts` file.

## 🧪 **Testing Environment**

For testing, you can create a `.env.test` file:

```bash
# .env.test
EXPO_PUBLIC_APP_ENV=test
EXPO_PUBLIC_FIREBASE_PROJECT_ID=test
EXPO_PUBLIC_ENABLE_TRANSCRIPTION=false
EXPO_PUBLIC_ENABLE_VOLUME_DETECTION=true
```

## 📊 **Environment Validation**

The app includes automatic environment validation:

```typescript
// This will throw an error if required variables are missing
validateEnvironment();
```

## 🎯 **Next Steps**

1. **Test the configuration** by running `expo start`
2. **Create environment-specific files** if needed
3. **Set up Firebase emulators** for development

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **"Missing required environment variable"**

   - Check that all variables have `EXPO_PUBLIC_` prefix
   - Ensure `.env` file is in the root directory

2. **"Firebase not initialized"**

   - Verify Firebase config values are correct
   - Check that project ID matches your Firebase project

3. **"Transcription service not available"**
   - Verify OpenAI API key is valid
   - Check API key has proper permissions

## 📚 **Additional Resources**

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Firebase Configuration](https://firebase.google.com/docs/web/setup)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
