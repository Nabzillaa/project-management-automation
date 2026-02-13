# Nabz TV - Complete Deployment Guide

## System Overview

Nabz TV is a complete IPTV solution with:
- **Backend API**: Node.js server for user authentication and playlist management
- **Android App**: Modern Jetpack Compose app for streaming IPTV content

---

## Part 1: Backend Deployment

### Local Development

1. **Install Node.js** (16 or higher)
   ```bash
   # Check if Node.js is installed
   node --version
   npm --version
   ```

2. **Setup Backend**
   ```bash
   cd NabzTV-Backend
   npm install
   cp .env.example .env
   ```

3. **Configure Environment**
   Edit `.env` file:
   ```env
   PORT=3000
   JWT_SECRET=change-this-to-a-secure-random-string
   NODE_ENV=development
   ```

4. **Run Backend**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

   Server will be available at `http://localhost:3000`

---

### Production Deployment

#### Option 1: VPS (Digital Ocean, Linode, AWS EC2)

**1. Setup VPS**
```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2
```

**2. Deploy Application**
```bash
# Create directory
mkdir -p /var/www/nabztv-backend
cd /var/www/nabztv-backend

# Upload your code (use git, scp, or rsync)
git clone <your-repo-url> .
# OR
scp -r NabzTV-Backend/* root@your-server-ip:/var/www/nabztv-backend/

# Install dependencies
npm install --production

# Setup environment
cp .env.example .env
nano .env  # Edit with production values
```

**3. Configure PM2**
```bash
# Start application with PM2
pm2 start server.js --name nabztv-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Check status
pm2 status
pm2 logs nabztv-api
```

**4. Setup Nginx (Reverse Proxy)**
```bash
# Install Nginx
apt install -y nginx

# Create Nginx config
nano /etc/nginx/sites-available/nabztv-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/nabztv-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

**5. Setup SSL with Let's Encrypt**
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d your-domain.com

# Test auto-renewal
certbot renew --dry-run
```

**Your backend is now live at:** `https://your-domain.com`

---

#### Option 2: Heroku (Easiest)

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Deploy**
   ```bash
   cd NabzTV-Backend

   # Login to Heroku
   heroku login

   # Create app
   heroku create nabztv-api

   # Set environment variables
   heroku config:set JWT_SECRET=your-super-secret-key
   heroku config:set NODE_ENV=production

   # Initialize git (if not already)
   git init
   git add .
   git commit -m "Initial commit"

   # Deploy
   git push heroku main

   # View logs
   heroku logs --tail
   ```

**Your backend is now live at:** `https://nabztv-api.herokuapp.com`

---

#### Option 3: Railway / Render (Also Easy)

1. Go to [railway.app](https://railway.app) or [render.com](https://render.com)
2. Click "New Project" → "Deploy from GitHub"
3. Connect your repository
4. Set environment variables:
   - `JWT_SECRET`: Your secret key
   - `NODE_ENV`: `production`
5. Deploy!

---

## Part 2: Android App Configuration

### Update Backend URL in App

1. **Open the project in Android Studio**

2. **Update Backend URL**

   Edit: `NabziTV/core/api/src/main/kotlin/com/nabzi/tv/core/api/BackendRepository.kt`

   Line 17, change:
   ```kotlin
   // For local testing (Android emulator)
   private val baseUrl = "http://10.0.2.2:3000/"

   // For production, change to:
   private val baseUrl = "https://your-domain.com/"
   ```

3. **Rebuild the project**
   ```
   Build → Clean Project
   Build → Rebuild Project
   ```

---

### Build APK

#### Debug APK (for testing)
```bash
cd NabziTV
./gradlew assembleDebug

# APK location:
# app/build/outputs/apk/debug/app-debug.apk
```

#### Release APK (for distribution)

1. **Create keystore** (first time only)
   ```bash
   keytool -genkey -v -keystore nabztv-release.keystore \
     -alias nabztv -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure signing**

   Create `NabziTV/keystore.properties`:
   ```properties
   storePassword=your-store-password
   keyPassword=your-key-password
   keyAlias=nabztv
   storeFile=../nabztv-release.keystore
   ```

3. **Update `app/build.gradle.kts`**

   Add before `android {`:
   ```kotlin
   val keystorePropertiesFile = rootProject.file("keystore.properties")
   val keystoreProperties = Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(FileInputStream(keystorePropertiesFile))
   }
   ```

   Update `signingConfigs`:
   ```kotlin
   signingConfigs {
       create("release") {
           keyAlias = keystoreProperties["keyAlias"] as String
           keyPassword = keystoreProperties["keyPassword"] as String
           storeFile = file(keystoreProperties["storeFile"] as String)
           storePassword = keystoreProperties["storePassword"] as String
       }
   }
   ```

4. **Build release APK**
   ```bash
   ./gradlew assembleRelease

   # APK location:
   # app/build/outputs/apk/release/app-release.apk
   ```

---

## Part 3: Testing the System

### Test Backend API

```bash
# Health check
curl https://your-domain.com/health

# Register user
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Login
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Get playlists (replace TOKEN with JWT from login)
curl https://your-domain.com/api/playlists \
  -H "Authorization: Bearer TOKEN"
```

### Test Android App

1. Install APK on device/emulator
2. Create account or login
3. Add a playlist with your IPTV server details:
   - Name: My IPTV
   - Server URL: http://your-iptv-server:8080
   - Username: your-username
   - Password: your-password
4. Select the playlist
5. Browse Live TV, Movies, Series

---

## Part 4: App Distribution

### Google Play Store

1. **Create Developer Account**
   - Go to [play.google.com/console](https://play.google.com/console)
   - Pay $25 one-time fee

2. **Prepare Assets**
   - App icon (512x512px)
   - Feature graphic (1024x500px)
   - Screenshots (phone, tablet, TV)
   - Privacy policy URL

3. **Upload APK**
   - Create new app
   - Upload release APK
   - Fill in store listing
   - Set content rating
   - Submit for review

### Direct Distribution (APK)

1. Host APK on your website
2. Users download and install
3. Enable "Install from Unknown Sources" on Android

---

## Part 5: Maintenance

### Backend Monitoring

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs nabztv-api

# Restart service
pm2 restart nabztv-api

# Check server resources
htop
df -h
```

### Database Backup

```bash
# Backup SQLite database
cp /var/www/nabztv-backend/nabztv.db /backup/nabztv-$(date +%Y%m%d).db

# Setup automatic daily backup
crontab -e
# Add: 0 2 * * * cp /var/www/nabztv-backend/nabztv.db /backup/nabztv-$(date +\%Y\%m\%d).db
```

### App Updates

1. Increment `versionCode` and `versionName` in `app/build.gradle.kts`
2. Build new release APK
3. Upload to Play Store or distribute

---

## Security Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Use HTTPS for backend (SSL certificate)
- [ ] Keep Node.js and dependencies updated
- [ ] Enable firewall on server
- [ ] Use strong passwords for server access
- [ ] Regularly backup database
- [ ] Monitor server logs for suspicious activity
- [ ] Use ProGuard/R8 for APK obfuscation

---

## Troubleshooting

### Backend Issues

**Can't connect to backend from app:**
- Check backend is running: `pm2 status`
- Verify URL in BackendRepository.kt
- Check firewall allows port 3000 (or 80/443 with Nginx)
- Test API with curl from terminal

**Database errors:**
- Check permissions: `ls -la nabztv.db`
- Verify disk space: `df -h`
- Check logs: `pm2 logs nabztv-api`

### App Issues

**Build errors:**
```bash
# Clean and rebuild
./gradlew clean
./gradlew build --refresh-dependencies
```

**App crashes:**
- Check Logcat in Android Studio
- Verify backend URL is correct
- Check network permissions in AndroidManifest.xml

---

## Support & Resources

- **Backend Code**: `/Users/nabilsabih/test_folder/App/NabzTV-Backend/`
- **Android App**: `/Users/nabilsabih/test_folder/App/NabziTV/`
- **API Documentation**: Backend README.md
- **Node.js**: https://nodejs.org/
- **Android Studio**: https://developer.android.com/studio

---

## Quick Start Summary

**Backend (5 minutes):**
```bash
cd NabzTV-Backend
npm install
cp .env.example .env
# Edit .env with strong JWT_SECRET
npm start
```

**App (10 minutes):**
1. Update backend URL in `BackendRepository.kt`
2. Open project in Android Studio
3. Build → Generate Signed Bundle/APK
4. Install on device

**Done!** 🎉

Your complete IPTV system is now running with user accounts, playlist management, and streaming capabilities.
