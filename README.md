# Whispr

A minimalist audio-based social app where users record and post **short whispers** anonymously.

This project uses **React Native + Expo**, Firebase for backend services, and AI-powered transcription for whisper moderation. It also includes a volume-based whisper detection as part of the core MVP experience.

---

## 🧱 Stack Overview

| Layer         | Tech Stack                        |
| ------------- | --------------------------------- |
| Mobile App    | React Native + Expo               |
| Styling       | Tailwind (via NativeWind) + Paper |
| State         | React Context or Zustand          |
| Audio         | `expo-av`                         |
| Auth          | Firebase Anonymous Auth           |
| DB            | Firebase Firestore                |
| File Storage  | Firebase Storage (audio files)    |
| Transcripts   | OpenAI Whisper API                |
| Whisper Check | Volume-based threshold (MVP)      |
| Component Dev | Storybook for React Native        |

---

## 📁 Folder Structure (MVP)

This is the initial structure designed for the **MVP** version. It is simple, testable, and scalable.

```bash
src/
├── assets/             # Images, audio icons, etc.
├── components/         # Reusable UI components
├── hooks/              # Custom hooks (e.g. useAudioRecorder)
├── navigation/         # Stack and tab navigation configs
├── screens/            # App screens (Record, Feed, etc.)
├── services/           # Firebase, transcription, audio services
├── context/            # Zustand or Context store(s)
├── storybook/          # Storybook stories and configuration
├── utils/              # General utility functions (e.g., whisper validator)
├── config/             # Constants and environment setup
└── types/              # TypeScript types/interfaces
```

---

## 🔧 Setup Instructions

1. **Clone and install dependencies**

```bash
git clone https://github.com/YOUR_USERNAME/whispr.git
cd whispr
npm install
```

2. **Set up Firebase project**

- Go to [Firebase Console](https://console.firebase.google.com/)
- Create a project `Whispr`
- Enable **Authentication** → Anonymous
- Enable **Firestore** and **Storage**
- Add your Firebase config to `.env`

```
FIREBASE_API_KEY=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_APP_ID=xxx
```

3. **Set up Expo**

```bash
npx expo start
```

4. **Run Storybook (React Native)**

```bash
npm run storybook
```

---

## 📄 Claude Tasks You Can Run

Paste this inside Cursor or Claude’s chat:

> 💬 **"Use the following folder structure and create a minimal working React Native + Firebase Expo app that lets users record audio using `expo-av`, stores audio in Firebase Storage, and logs a document in Firestore. Also generate a `useAudioRecorder()` hook, and implement local volume-based whisper detection before upload. Include Storybook setup."**

Or break down into steps:

1. Generate `useAudioRecorder.ts`
2. Add `utils/whisperValidator.ts` with volume threshold logic
3. Set up `firebase.ts` config + SDKs
4. Create `RecordScreen.tsx` using the recorder + whisper validator + Firebase upload
5. Create `FeedScreen.tsx` to list Firestore audio posts
6. Add `transcribeAudio.ts` using OpenAI Whisper API
7. Set up `storybook/` and create example stories in `components/`
8. Configure `navigation/` with a basic stack for `RecordScreen` and `FeedScreen`

---

## 🚀 Scaling Plan (Beyond MVP)

### 🔧 Tech Evolution

| Layer         | Current (MVP)    | Future (Scalable)                      |
| ------------- | ---------------- | -------------------------------------- |
| Backend       | Firebase         | Custom NestJS API + PostgreSQL + Redis |
| Hosting       | Firebase / Expo  | Railway, Render, or AWS (ECS/Lambda)   |
| Transcription | Whisper API      | On-device inference (future), batching |
| File Storage  | Firebase Storage | Amazon S3 (with CDN for delivery)      |
| Whisper Check | Volume Threshold | ML-based detection / model classifier  |
| Monorepo      | -                | Turborepo w/ shared packages           |
| Web           | -                | React Native Web                       |

### 🌱 Planned Features

- Whisper moderation (volume threshold or ML-based whisper detection)
- Transcription filtering and keyword moderation
- Public/Private/Secret posting modes
- Anonymous reactions (emojis or vibes)
- Follower system (optional identity)
- Trending whispers and discover feed
- Scheduled posting or reply-to-whisper
- Profile with anonymous stats (e.g., likes, whispers posted)
- Push notifications (e.g., someone whispered back)
- Admin dashboard for moderation and analytics

---

## 📦 Dev Tools

- 📱 Expo Dev Client
- 📚 Storybook for RN (UI prototyping)
- 🧪 Jest + Testing Library
- 🧠 Cursor + Claude + ChatGPT (co-pilots)

---

## 🧠 AI Ideas

- Whisper detection (AI model or volume filter)
- Transcription filtering (keyword moderation)
- Text-to-image generation for cover art
- Whisper sentiment analysis (tone, emotion)

---

## 👥 Credits

- **You** – Senior React/Node.js dev
- **Your sister** – UI/UX design

---

## ✅ Summary

You now have:

- A working MVP folder structure
- Whisper detection enforcement logic planned from day one
- Storybook integration for fast design/dev collaboration
- Firebase ready for Auth + Storage + Firestore
- `useAudioRecorder`, navigation scaffold, and sample stories underway
- A clear roadmap for short-term and long-term evolution

The project is now scalable, maintainable, and flexible.

Ready to whisper your way to viral traction 👻

Ready to build something whisper-quiet but loud in impact 👻
