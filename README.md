# ReclaimIt - Lost & Found Items Platform

A full-stack mobile application built with React Native (Expo) and Node.js that helps people report lost items and find items that others have found. The platform uses intelligent matching algorithms to connect people who have lost items with those who have found them.

## 🚀 Features

### For Users
- **Report Lost Items** - Post details about items you've lost with location, description, photos, and categories
- **Report Found Items** - Help others by reporting items you've found
- **Smart Matching** - Automated matching system that connects lost and found items based on:
  - Geographic proximity
  - Item descriptions and categories
  - Brand names and colors
  - Date/time correlation
- **Real-time Chat** - Built-in messaging system to coordinate returns
- **Location-based Search** - Interactive maps using OpenStreetMap
- **Push Notifications** - Get notified when potential matches are found
- **User Authentication** - Secure authentication powered by Clerk

### Technical Features
- 📱 Cross-platform (iOS & Android)
- 🔐 Secure authentication with Clerk
- 🗺️ Interactive maps with react-native-maps
- 💬 Real-time messaging with Socket.io
- 📸 Image upload with Cloudinary
- 🎯 Geolocation and reverse geocoding
- 🔔 Smart notification system
- 📊 Matching score algorithms
- ⚡ Real-time online/offline status

## 🛠️ Tech Stack

### Frontend (Mobile)
- **Framework**: React Native 0.81.5 + Expo 54
- **Navigation**: Expo Router 6.0
- **Authentication**: Clerk Expo 2.11
- **State Management**: React Hooks
- **Networking**: Axios, Socket.io Client
- **Maps**: React Native Maps 1.20
- **UI Components**: 
  - React Native Gesture Handler
  - React Native Reanimated
  - Expo Image Picker
  - Datetimepicker
  - Keyboard Aware ScrollView

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Authentication**: Clerk SDK Node
- **Real-time**: Socket.io 4.8
- **File Upload**: Multer + Cloudinary
- **Rate Limiting**: Upstash Redis
- **Scheduled Tasks**: node-cron
- **CORS**: Enabled for cross-origin requests

## 📁 Project Structure

```
wallet-app-expo/
├── mobile/                    # React Native mobile app
│   ├── app/                   # Expo Router screens
│   │   ├── (auth)/           # Authentication screens
│   │   ├── (modals)/         # Modal screens (report forms)
│   │   ├── (root)/           # Protected routes
│   │   └── (tabs)/           # Tab navigation
│   ├── assets/               # Images, fonts, styles
│   ├── components/           # Reusable components
│   ├── config/               # Configuration (env, constants)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities and helpers
│   └── services/             # API and Socket.io services
│
├── backend/                   # Node.js backend
│   └── src/
│       ├── config/           # Database, Cloudinary, Socket.io
│       ├── controllers/      # Business logic
│       ├── middleware/       # Auth and file upload
│       ├── models/           # MongoDB schemas
│       ├── routes/           # API endpoints
│       ├── services/         # Background services
│       └── utils/            # Helper functions
│
└── start-dev.bat             # Windows dev server launcher
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v18.17.0 or higher)
- npm or yarn
- MongoDB instance (local or cloud)
- Expo Go app (for mobile testing)
- Cloudinary account
- Clerk account
- Android Studio / Xcode (for native builds)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd wallet-app-expo
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install mobile dependencies**
```bash
cd ../mobile
npm install
```

4. **Set up environment variables**

**Backend** - Create `backend/.env`:
```env
# Server
PORT=5001

# Database
MONGODB_URI=your_mongodb_connection_string

# Clerk
CLERK_SECRET_KEY=your_clerk_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

**Mobile** - Update `mobile/app.json`:
```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "http://your-backend-url:5001/api",
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "your_clerk_publishable_key"
    }
  }
}
```

### Running the App

#### Development Mode

**Option 1: Use the batch script (Windows)**
```bash
./start-dev.bat
```

**Option 2: Manual start**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Mobile:
```bash
cd mobile
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app for physical device

### Building for Production

#### Android APK
```bash
cd mobile
eas build --platform android --profile preview
```

#### iOS
```bash
cd mobile
eas build --platform ios --profile preview
```

## 🔑 Key Features Explained

### Smart Matching Algorithm

The backend automatically matches lost and found items using:

1. **Geographic Scoring** (40 points)
   - Calculates distance between lost and found locations
   - Higher score for closer proximity

2. **Description Similarity** (25 points)
   - Uses keyword matching
   - Compares item descriptions

3. **Category Match** (15 points)
   - Exact category matching

4. **Color Match** (10 points)
   - Exact color matching

5. **Brand Match** (10 points)
   - Brand name matching

**Match Strength Levels:**
- Strong: 70+ points
- Medium: 50-69 points
- Weak: Below 50 (not shown)

### Permission Management

The app implements **just-in-time permissions**:
- Camera/Photo Library: Only when user uploads image
- Location: On first form load, but non-blocking
- All forms work even if permissions are denied

### Image Upload System

- Images uploaded to Cloudinary (temp folder initially)
- Automatic cleanup of temp images after 24 hours
- Progress tracking with fallback for poor networks
- Secure token-based upload

## 🔐 Security Features

- ✅ Clerk authentication (OAuth + Email)
- ✅ Token-based API authorization
- ✅ Rate limiting with Upstash Redis
- ✅ Secure environment variable handling
- ✅ HTTPS-only in production
- ✅ CORS configuration
- ✅ Input validation
- ✅ SecureStore for sensitive data

## 📱 App Screens

1. **Authentication**
   - Sign In / Sign Up
   - OAuth (Google)

2. **Home**
   - Recent lost/found items
   - Notifications badge
   - Quick actions

3. **Report Lost Item**
   - Item details form
   - Optional image upload
   - Interactive map
   - Location search

4. **Report Found Item**
   - Item details form
   - Required image upload
   - Interactive map
   - Location search

5. **Chat**
   - List of conversations
   - Real-time messaging
   - Online/offline status
   - Read receipts

6. **Profile**
   - User information
   - Posted items management
   - Sign out

## 🐛 Troubleshooting

### Common Issues

**1. App crashes on APK but works in Expo Go**
- Ensure all native dependencies are properly configured
- Check `app.json` plugins array
- Remove non-existent config plugins

**2. Image upload stuck at 0%**
- Check network connection
- Verify Cloudinary credentials
- Backend should be accessible

**3. Maps not showing**
- Ensure location permissions granted
- Check react-native-maps configuration
- Verify Google Maps API key (Android)

**4. Socket connection fails**
- Check API_URL in app.json
- Ensure backend server is running
- Verify CORS settings

## 🚀 Deployment

### Backend (Render/Railway/Heroku)
```bash
cd backend
# Add environment variables in hosting platform
# Deploy using Git integration or CLI
```

### Mobile (EAS Build)
```bash
cd mobile
eas build --platform all --profile production
eas submit --platform all
```

## 📄 License

This project is licensed under the MIT License.

## 👥 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

## 🙏 Acknowledgments

- Clerk for authentication
- Cloudinary for image hosting
- OpenStreetMap for map tiles
- Expo team for the amazing framework
- MongoDB for database services

---

**Made with ❤️ using React Native & Node.js**
