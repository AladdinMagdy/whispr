const path = require('path');
const fs = require('fs');

// Load test environment variables
const testEnvPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(testEnvPath)) {
  const envContent = fs.readFileSync(testEnvPath, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return [key.trim(), valueParts.join('=').trim()];
    });

  envVars.forEach(([key, value]) => {
    if (key && value) {
      process.env[key] = value;
    }
  });
}

// Set default test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.EXPO_PUBLIC_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'test';