# ReclaimIt — Project Documentation

> A complete reference for the ReclaimIt lost-and-found platform, written for a college project report. Every section can be read independently. File references use `path:line` for direct navigation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Folder Structure](#4-folder-structure)
5. [Database Design](#5-database-design)
6. [API Documentation](#6-api-documentation)
7. [Application Workflow](#7-application-workflow)
8. [Frontend Analysis](#8-frontend-analysis)
9. [Backend Analysis](#9-backend-analysis)
10. [Security &amp; Validation](#10-security--validation)
11. [Challenges &amp; Design Decisions](#11-challenges--design-decisions)
12. [Scalability &amp; Future Enhancements](#12-scalability--future-enhancements)
13. [Deployment](#13-deployment)
14. [Conclusion](#14-conclusion)

---

## 1. Project Overview

### 1.1 Problem Statement

Every day, students and commuters lose phones, wallets, IDs, bags, and keys on campuses, in transit hubs, and around city landmarks. Traditional lost-and-found systems are paper-based or scattered across institutional notice boards, so reunion rates are low. Reports are also abused: fake listings, AI-generated images, and scams reduce trust in the system.

### 1.2 Solution

**ReclaimIt** is an AI-assisted lost-and-found platform that pairs a lost report with a matching found report automatically. It uses two layers of intelligence:

- A **Google Gemini** model that scores 0–100 how similar two reports are (location, title, color, brand, time).
- A deterministic **rule-based fallback** (name/description token overlap, exact field matching, time and distance proximity) that runs whenever Gemini is unavailable.

The product is delivered as:

- A cross-platform **React Native (Expo)** mobile app for the public.
- A **React + Vite** admin portal for moderators (item queue, user bans, matching config, dispute resolution, institution management).
- A **Node.js + MongoDB** backend with Socket.io real-time chat.

### 1.3 Feature Summary (from `README.md`)

- Report lost or found items with photo, location, brand, color, category, date.
- Automatic AI matching of lost ↔ found reports.
- Real-time text chat between matched users.
- English UI.
- Institution scoping (university domains auto-enrol users as members).
- Admin moderation, manual match override, ban/flag, dispute transcript viewer.

### 1.4 Key Concepts in Plain English

- **Lost report** — a user reports something they have lost.
- **Found report** — a user reports something they have found.
- **Match** — when the system thinks a lost and a found report refer to the same item. Each side is then notified and a chat is opened.
- **Strength** — `strong` (≥70), `medium` (≥50), `weak` (<50) based on the match score.
- **Chat** — a real-time conversation between the owner of a lost item and the finder after a match is created.

---

## 2. Tech Stack

### 2.1 One-glance Table

| Layer              | Service                                    | Tech                                             | Version (from manifests)                                                    |
| ------------------ | ------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Mobile             | `mobile/`                                | Expo (React Native)                              | expo 54, react-native 0.81.5, react 19.1                                    |
| Admin web          | `admin-web/`                             | Vite + React                                     | vite 6, react 19                                                            |
| Backend            | `backend/`                               | Node.js + Express                                | express 4.21, mongoose 9                                                    |
| Auth               | shared                                     | Clerk (hosted)                                   | @clerk/clerk-sdk-node 4.13, @clerk/clerk-expo 2.11, @clerk/clerk-react 5.24 |
| DB                 | shared                                     | MongoDB (Mongoose)                               | mongoose 9                                                                  |
| Real-time          | `backend/src/config/socket.js`           | Socket.io                                        | socket.io 4.8                                                               |
| Cloud media        | shared                                     | Cloudinary                                       | cloudinary 2.x, multer-storage-cloudinary                                   |
| LLM matching       | `backend/src/services/geminiMatching.js` | Google Gemini                                    | gemini-2.5-flash                                                            |
| Matching fallback  | `backend/src/controllers/matching.js`    | deterministic rule-based scoring                 | Jaccard similarity + field weights                                          |
| Object storage     | shared                                     | Cloudinary (images), local `temp/` (transient) |                                                                             |
| Maps               | `mobile/app/(modals)/report-lost.jsx`    | react-native-maps + OSM tiles                    | react-native-maps 1.20                                                      |
| Chat               | `mobile/app/chat-conversation.jsx`       | text messaging via Socket.io                   |                                                                             |
| Background jobs    | `backend/src/config/cron.js`             | node-cron                                        | cron 4.x                                                                    |

### 2.2 Environment Variables (from `.env` files)

**`backend/.env`** (consumed by `backend/src/server.js` and configs)

| Variable                                                 | Purpose                                                |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `MONGODB_URL`                                          | Mongo connection string                                |
| `PORT`                                                 | Express port (default 5001)                            |
| `NODE_ENV`                                             | `development` / `production` (gates temp cleanup)  |
| `CLERK_PUBLISHABLE_KEY`                                | Frontend Clerk key                                     |
| `CLERK_SECRET_KEY`                                     | Backend Clerk verify key                               |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | Cloudinary account                                     |
| `CLOUDINARY_TEMP_FOLDER`                               | Default `reclaimit/temp`                             |
| `CLOUDINARY_ITEMS_FOLDER`                              | Default `reclaimit/items`                            |
| `GEMINI_API_KEY`                                       | Google Gemini key                                      |
| `GEMINI_MODEL`                                         | Default `gemini-2.5-flash`                           |
| `MATCH_PROVIDER`                                       | `gemini` (default `gemini`)              |

**`mobile/.env`**

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

**`admin-web/.env`**

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

---

## 3. System Architecture

ReclaimIt follows a **service-oriented architecture** with three independently deployable services. The mobile and admin clients never talk to the AI services directly — they always go through the backend, which acts as an API gateway and orchestration layer. All matching AI is cloud-hosted (Google Gemini), so no local ML services need to run.

### 3.1 High-Level Diagram

```mermaid
flowchart LR
    subgraph Clients
        M[Mobile App<br/>React Native / Expo]
        A[Admin Web<br/>React + Vite]
    end

    subgraph Gateway
        B[Backend<br/>Node + Express + Socket.io<br/>:5001]
    end

    subgraph Cloud
        C[Cloudinary<br/>Image CDN]
        G[Google Gemini<br/>LLM API]
    end

    subgraph Data
        D[(MongoDB<br/>reclaimit)]
    end

    subgraph Auth
        K[Clerk<br/>Hosted Auth]
    end

    M -- REST + Socket.io --> B
    A -- REST --> B
    M -- OAuth / JWT --> K
    A -- OAuth / JWT --> K
    B -- Verify JWT --> K
    B -- Persist --> D
    B -- Upload / delete --> C
    B -- Generate text --> G
```

### 3.2 Request Flow (Plain English)

1. The mobile app or admin portal authenticates a user through **Clerk** (email/password or Google).
2. Clerk returns a JWT, which the client attaches to every request as `Authorization: Bearer <token>`.
3. The backend **verifies** the token (`backend/src/middleware/clerkAuth.js`), finds or creates the user in MongoDB (`utils/userSync.js`), and gates admin routes with `adminAuth.middleware.js`.
4. Business logic lives in **controllers** under `backend/src/controllers/` and `backend/src/admin/controllers/`. They use **models** (Mongoose) and **services** for AI.
5. For matching, the backend calls **Gemini** (`backend/src/services/geminiMatching.js`) which returns a 0–100 score. If Gemini is unavailable, it falls back to the deterministic rule-based scorer in `controllers/matching.js`.
6. Real-time chat runs over **Socket.io** with the same JWT verification on connection (`backend/src/config/socket.js`).
7. All long-lived images are in **Cloudinary**; temporary uploads live in the `reclaimit/temp` Cloudinary folder and are pruned every 30 min by a cron job (`config/tempImageCleanup.js`).

### 3.3 Sequence — "User reports a found item"

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant B as Backend
    participant C as Cloudinary
    participant D as MongoDB
    participant G as Gemini
    participant S as Socket.io

    App->>B: POST /api/upload/temp (multipart)
    B->>C: upload (folder: reclaimit/temp)
    C-->>B: {secure_url, public_id}
    B-->>App: {image: {url, publicId}}

    App->>B: POST /api/items {type:FOUND, image, ...}
    B->>D: insert Item
    B->>G: prompt with item pair (sourceItem, candidates)
    G-->>B: [{candidateId, matchScore}, ...]
    alt Gemini unavailable
        B->>B: rule-based fallback scoring
    end
    B->>D: persist MatchedItem
    B->>D: create Notification for each user
    B-->>S: emit notification:new
    S-->>App: realtime push
    B-->>App: {item, matches}
```

---

## 4. Folder Structure

```
D:\Downloads\Reclaimit\
├── README.md                  # Top-level feature list and quickstart
├── start-dev.bat              # Windows launcher for all 3 services
├── update-ip.ps1              # Patches mobile/app.json with current WiFi IPv4
├── ReClaimIt1.pdf             # Original problem statement / report
│
├── mobile/                    # Expo React Native app (public users)
│   ├── app/                   # File-based routes (expo-router)
│   │   ├── _layout.jsx        # I18n + Clerk + SafeScreen + Slot
│   │   ├── (auth)/            # Unauthenticated stack
│   │   │   ├── _layout.jsx
│   │   │   ├── sign-in.jsx
│   │   │   └── sign-up.jsx
│   │   ├── (root)/            # Authenticated stack + ban modal
│   │   │   ├── _layout.jsx
│   │   │   └── ...            # detail/match/institution routes
│   │   ├── (tabs)/            # Bottom tab bar pages
│   │   │   ├── index.jsx      # Home
│   │   │   ├── chat.jsx
│   │   │   └── profile.jsx
│   │   ├── (modals)/
│   │   │   ├── report-lost.jsx
│   │   │   └── report-found.jsx
│   │   ├── chat-conversation.jsx
│   │   ├── item/[id]/edit.jsx
│   │   └── oauth-native-callback.jsx
│   ├── components/            # RecentItemCard, BottomNavBar, PageLoader, ...
│   ├── hooks/                 # useItemReportForm, useImageUpload
│   ├── i18n/                  # I18nProvider + EN/HI translations
│   ├── services/              # api.js (axios) and socket.js (SocketService)
│   ├── config/env.js          # Reads EXPO_PUBLIC_* from app.json
│   ├── constants/             # colors (themes) and api (legacy URL)
│   ├── lib/                   # cache (SecureStore token), utils
│   ├── assets/styles/         # report-form, auth, home, create style sheets
│   ├── app.json               # Expo config + extra envs
│   └── package.json
│
├── admin-web/                 # React + Vite admin portal
│   ├── index.html
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx           # ClerkProvider + createRoot
│   │   ├── App.jsx            # AuthGate + Layout + 7 tab pages
│   │   ├── components/        # AuthGate, Layout, ui
│   │   ├── pages/             # Dashboard, Moderation, Users, Institutions,
│   │   │                        Matching, Disputes, Settings
│   │   ├── services/adminApi.js
│   │   ├── utils/             # adminMappers, format
│   │   ├── data/mockData.js   # Fallback metrics
│   │   └── styles.css
│   ├── public/reclaimit-logo.png
│   └── package.json
│
└── backend/                   # Express + Mongoose + Socket.io API
│   ├── package.json
│   ├── .env
│   ├── temp/                  # Short-lived uploads before Cloudinary push
│   └── src/
│       ├── server.js          # HTTP + Socket.io + cron bootstrap
│       ├── app.js             # Express app, route mounting
│       ├── config/            # db, cloudinary, socket, cron, tempImageCleanup
│       ├── middleware/        # clerkAuth, upload (multer)
│       ├── models/            # user, item, chat, message, matchedItem,
│       │                       # notification, institution
│       ├── routes/            # items, users, upload, matching,
│       │                       # notifications, chat, institutions
│       ├── controllers/       # items, matching, chat, notifications,
│       │                       # institutions
│       ├── services/          # geminiMatching
│       ├── admin/
│       │   ├── routes.js
│       │   ├── controllers/   # dashboard, items, users, matching,
│       │   │                   # institutions, chats
│       │   ├── middleware/adminAuth.middleware.js
│       │   ├── models/adminConfig.model.js
│       │   └── utils/         # matchingConfig, constants, ids,
│       │                       # pagination, slugify
│       └── utils/userSync.js  # getOrCreateUser, syncUserInstitutionMembership
```


---

## 5. Database Design

The backend uses **MongoDB** (database name `reclaimit`) with seven first-class collections and a key/value `adminconfigs` collection for runtime matching settings. Mongoose enforces schemas, validators, and pre-save hooks.

### 5.1 Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ITEM : "owns (userId)"
    USER ||--o{ CHAT : "participates in"
    USER ||--o{ NOTIFICATION : "receives"
    USER }o--o{ INSTITUTION : "member of"
    ITEM ||--o{ MATCHEDITEM : "appears as sourceItem or matchedItem"
    ITEM ||--o{ CHAT : "linked via items[]"
    CHAT ||--o{ MESSAGE : "contains"
    INSTITUTION ||--o{ USER : "scopes via emailDomains"

    USER {
        ObjectId _id
        string clerkId
        string email
        string name
        string avatar
        string role "USER | ADMIN"
        string status "ACTIVE | BANNED | FLAGGED"
        ObjectId[] institutions
        number reportCount
        number claimCount
    }
    ITEM {
        ObjectId _id
        ObjectId userId
        string type "LOST | FOUND"
        string itemName
        string description
        string category
        string color
        string brandName
        string location.name
        GeoJSON location.coordinates
        Object image { url, publicId }
        string status "ACTIVE | FLAGGED | ARCHIVED | MATCHED | CLAIMED"
        Date date
    }
    CHAT {
        ObjectId _id
        ObjectId[] participants  "exactly 2"
        ObjectId[] items
        ObjectId matchedItem
        Map unreadCount
        string status "active | archived | blocked"
    }
    MESSAGE {
        ObjectId _id
        ObjectId chatId
        ObjectId sender
        string type "text | system"
        string content
        ObjectId[] readBy
        string status "sent | delivered | read"
    }
    MATCHEDITEM {
        ObjectId _id
        ObjectId sourceItem
        ObjectId matchedItem
        ObjectId sourceUser
        ObjectId matchedUser
        number matchScore
        string matchStrength "strong | medium | weak"
        Object breakdown "locationScore, titleScore, brandScore, colorScore"
        number distanceKm
        string status "pending | accepted | rejected | expired"
        boolean notifications.sentToSource
        boolean notifications.sentToMatched
    }
    NOTIFICATION {
        ObjectId _id
        ObjectId user
        string type
        string title
        string body
        ObjectId item
        Object meta
        boolean read
    }
    INSTITUTION {
        ObjectId _id
        string name
        string slug "unique"
        string description
        string[] emailDomains
        string[] adminEmails
        string status "ACTIVE | INACTIVE"
        Object logo
    }
    ADMINCONFIG {
        ObjectId _id
        string key "unique"
        Mixed value
    }
```

### 5.2 Important Schema Rules

- **User** (`backend/src/models/user.model.js`): indexed on `clerkId` and `email`; `role` defaults to `USER`. `status` can be `ACTIVE`/`BANNED`/`FLAGGED`. Ban and role are updated by the admin portal.
- **Item** (`item.model.js`): `type` is locked to `LOST` or `FOUND`. The image object records the Cloudinary `url`/`publicId`. `location.coordinates` is a `GeoJSON Point` (`[lng, lat]`) — required for the geo-distance scoring.
- **Chat** (`chat.model.js`): a pre-save hook asserts **exactly two** participants. `unreadCount` is a `Map<userId, number>`. The chat is linked to one or more `items` and optionally a `matchedItem`.
- **Message** (`message.model.js`): `type ∈ {text, system}` — plain text messages with read receipts.
- **MatchedItem** (`matchedItem.model.js`): 0–100 `matchScore` plus a pre-computed `matchStrength` (`strong ≥ 70`, `medium ≥ 50`, `weak < 50`). `breakdown` is the per-axis contribution (location, title, brand, color) so the admin UI can show dial widgets. `notifications` flags track whether each user has been pinged.
- **Notification** (`notification.model.js`): per-user feed used for in-app toasts and the bell badge.
- **Institution** (`institution.model.js`): `emailDomains` and `adminEmails` are normalized to lowercase and trimmed; `slug` is unique. The sync helper `syncUserInstitutionMembership` in `utils/userSync.js` matches a user's email domain or the explicit `adminEmails` array to attach memberships and promote admins.
- **AdminConfig** (`admin/admin/models/adminConfig.model.js`): a key/value store. The single current key is `matching`, value:
  ```json
  { "minimumScore": 70, "weights": { "location": 45, "title": 30, "brand": 15, "color": 10 } }
  ```

### 5.3 Indexing Notes

- `user` indexes: `clerkId` (unique), `email` (unique).
- `item` indexes: `userId`, `type`, `status`, plus the implicit GeoJSON index from `location.coordinates` (used by `$geoNear` style matching).
- `matcheditem` indexes: `sourceItem`, `matchedItem`, `sourceUser`, `matchedUser`, `status`.
- `chat` and `message` are denormalized for fast lookups (`participants`, `chatId`).
- `adminconfigs.key` is unique.

---

## 6. API Documentation

All routes are mounted under `/api` in `backend/src/app.js`. Authenticated routes require `Authorization: Bearer <clerk-jwt>`; the Clerk token is verified by `requireAuth` (`backend/src/middleware/clerkAuth.js`).

### 6.1 Health and Auth-light Routes

| Method | Path            | Auth   | Purpose                                                                  |
| ------ | --------------- | ------ | ------------------------------------------------------------------------ |
| GET    | `/api/health` | public | Liveness check (`db`, `cloudinaryConfigured`, `geminiConfigured`). |

### 6.2 Users — `backend/src/routes/users.js`

| Method | Path                            | Purpose                                                                                                            |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/users`                  | Sync the Clerk user to Mongo (`utils/userSync.getOrCreateUser`). Called by the mobile app after sign-in/sign-up. |
| GET    | `/api/users/me`               | Returns the current Mongo user.                                                                                    |
| PATCH  | `/api/users/me`               | Update name / avatar / language preference.                                                                        |
| GET    | `/api/users/institutions`     | Institutions the current user belongs to.                                                                          |
| GET    | `/api/users/institutions/:id` | Single institution (member or admin only).                                                                         |

### 6.3 Items — `backend/src/routes/items.js`

| Method | Path                      | Purpose                                                                                                       |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/items`            | Report a new item; triggers auto-matching (`controllers/items.js → matching.controller.autoMatchNewItem`). |
| GET    | `/api/items`            | List items with filters (`type`, `status`, `category`, `q`, pagination).                              |
| GET    | `/api/items/mine`       | Items owned by the caller.                                                                                    |
| GET    | `/api/items/:id`        | Item detail.                                                                                                  |
| PATCH  | `/api/items/:id`        | Edit (only owner). Re-runs matching if relevant fields change.                                                |
| DELETE | `/api/items/:id`        | Delete (owner only).                                                                                          |
| POST   | `/api/items/:id/status` | Update status (`ACTIVE`, `FLAGGED`, `ARCHIVED`, `MATCHED`, `CLAIMED`).                              |

### 6.4 Upload — `backend/src/routes/upload.js`

| Method | Path                  | Purpose                                                                                                                                              |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/upload/temp`  | Multipart upload → local disk → Cloudinary push to `reclaimit/temp` → return `{url, publicId}`. The local file is then deleted. |
| POST   | `/api/upload/image` | Direct Cloudinary upload for things like chat attachments.                                                                                           |

The temp route keeps a copy of uploaded images in Cloudinary's `reclaimit/temp` folder; `tempImageCleanup.js` removes them once they are no longer referenced by any `Item`.

### 6.5 Matching — `backend/src/routes/matching.js`

| Method | Path                         | Purpose                                  |
| ------ | ---------------------------- | ---------------------------------------- |
| GET    | `/api/matches`             | List matches involving the current user. |
| GET    | `/api/matches/:id`         | Single match detail.                     |
| POST   | `/api/matches/:id/respond` | Accept / reject a proposed match.        |

### 6.6 Notifications — `backend/src/routes/notifications.js`

| Method | Path                            | Purpose           |
| ------ | ------------------------------- | ----------------- |
| GET    | `/api/notifications`          | List, paginated.  |
| PATCH  | `/api/notifications/:id/read` | Mark one as read. |
| POST   | `/api/notifications/read-all` | Mark all as read. |
| DELETE | `/api/notifications/:id`      | Remove one.       |

### 6.7 Chat — `backend/src/routes/chat.js`

| Method | Path                                   | Purpose                                                    |
| ------ | -------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/chats`                         | List the user's chats.                                     |
| POST   | `/api/chats`                         | Get-or-create a chat between two users.                    |
| GET    | `/api/chats/:id/messages`            | Message history.                                           |
| POST   | `/api/chats/:id/messages`            | Send a text message.                                       |
| DELETE | `/api/chats/:id`                     | Soft delete (status `archived` or `blocked`).          |

### 6.8 Institutions — `backend/src/routes/institutions.js`

| Method | Path                       | Purpose                                       |
| ------ | -------------------------- | --------------------------------------------- |
| GET    | `/api/institutions/mine` | Caller's institutions.                        |
| GET    | `/api/institutions/:id`  | Public institution profile (member or admin). |

### 6.9 Admin — `backend/src/admin/routes.js`

All routes are gated by `requireAuth` then `requireAdmin`. The admin role is read from `publicMetadata.role === "admin"` on the Clerk token and confirmed against the Mongo user.

| Method | Path                                       | Purpose                                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------------------- |
| GET    | `/api/admin/dashboard/stats`             | Counts of active LOST/FOUND, matches, disputes, users, health flags. |
| GET    | `/api/admin/dashboard/analytics?days=14` | Timeseries for the dashboard chart.                                  |
| GET    | `/api/admin/items`                       | List with search + status filter.                                    |
| PUT    | `/api/admin/items/:id`                   | Quick edit (category, description, etc.).                            |
| PUT    | `/api/admin/items/:id/status`            | Approve, flag, archive, claim.                                       |
| DELETE | `/api/admin/items/:id`                   | Hard delete with Cloudinary cleanup.                                 |
| GET    | `/api/admin/users`                       | List with reports/claims aggregates.                                 |
| PUT    | `/api/admin/users/:id/ban`               | Ban / unban.                                                         |
| PUT    | `/api/admin/users/:id/role`              | Promote to admin.                                                    |
| PUT    | `/api/admin/users/:id/status`            | Set status (`ACTIVE`, `FLAGGED`, …).                            |
| GET    | `/api/admin/matching/matches`            | All match records.                                                   |
| POST   | `/api/admin/matching/override`           | Create a manual link with arbitrary score.                           |
| GET    | `/api/admin/matching/config`             | Read the runtime config.                                             |
| PUT    | `/api/admin/matching/config`             | Save new threshold and weights.                                      |
| GET    | `/api/admin/chats/disputes`              | List chats with blocked/recent status.                               |
| GET    | `/api/admin/chats/:id/transcript`        | Flat message list for audit.                                         |
| GET    | `/api/admin/institutions`                | List with filters.                                                   |
| POST   | `/api/admin/institutions`                | Create.                                                              |
| GET    | `/api/admin/institutions/:id`            | Detail.                                                              |
| PUT    | `/api/admin/institutions/:id`            | Update.                                                              |
| DELETE | `/api/admin/institutions/:id`            | Soft-archive.                                                        |
| POST   | `/api/admin/institutions/:id/restore`    | Unarchive.                                                           |
| GET    | `/api/admin/institutions/:id/members`    | Member roll.                                                         |

### 6.10 Real-time Events (Socket.io)

The handshake authenticates with the same Clerk JWT (`io.use` middleware in `config/socket.js`). The socket stores the user id and an in-memory presence map.

| Client event                       | Server reaction                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| `user:join`                      | Adds the user to the online map.                            |
| `chat:join`                      | Joins the room `chat:<chatId>`.                           |
| `message:send`                   | Persists the message and emits `message:new` to the room. |
| `typing:start` / `typing:stop` | Re-broadcast to the other participant.                      |
| `message:read`                   | Updates the message's `readBy` array and status.          |

The HTTP and Socket servers share one Node process started in `server.js`.

---

## 7. Application Workflow

This is the user-facing story. Mermaid sequence diagrams show how the pieces collaborate.

### 7.1 Sign-up and First Sync

```mermaid
sequenceDiagram
    participant U as User
    participant App as Mobile App
    participant Clerk as Clerk
    participant B as Backend
    participant D as MongoDB

    U->>App: Tap "Sign in with Google"
    App->>Clerk: useOAuth({strategy:'oauth_google'})
    Clerk-->>App: session + JWT
    App->>B: POST /api/users (Bearer)
    B->>Clerk: verify JWT
    B->>D: getOrCreateUser (utils/userSync.js)
    B->>D: syncUserInstitutionMembership
    D-->>B: User doc
    B-->>App: {user, institutions}
    App->>U: Land on home (tab layout)
```

`userSync.getOrCreateUser` (in `backend/src/utils/userSync.js`) is idempotent — the same Clerk id always yields the same Mongo user. The membership helper scans every active institution and adds the user to any whose `emailDomains` or `adminEmails` array matches their email.

### 7.2 Report Found Item

```mermaid
sequenceDiagram
    participant U as User
    participant App as Mobile App
    participant B as Backend
    participant C as Cloudinary
    participant D as MongoDB
    participant G as Gemini

    U->>App: Open "Report Found"
    U->>App: Pick photo, fill form, choose map pin
    App->>B: POST /api/upload/temp (image bytes)
    B->>C: cloudinary.uploader.upload
    C-->>B: {secure_url, public_id}
    B-->>App: {image:{url, publicId}}
    App->>B: POST /api/items {type:FOUND, ...}
    B->>D: insert Item
    B->>G: prompt with item pair (sourceItem, candidates)
    G-->>B: candidates scored
    alt Gemini unavailable
        B->>B: rule-based fallback scoring
    end
    B->>D: persist MatchedItem + Notification
    B-->>App: {item, matches}
```

### 7.3 Match and Chat

```mermaid
sequenceDiagram
    participant A as User A (lost)
    participant B as User B (found)
    participant S as Socket.io
    participant API as Backend

    API-->>A: socket notification:new (match found)
    API-->>B: socket notification:new
    A->>S: chat:join (chatId)
    B->>S: chat:join (chatId)
    A->>S: message:send {text}
    S->>API: persist
    API-->>B: message:new
    B->>S: typing:start
    S-->>A: typing
    B->>S: message:send {text}
    S-->>A: message:new
    A->>S: message:read
    API->>API: mark readBy + status=read
```

### 7.4 Admin Triage Flow

1. Admin opens the **Moderation** tab. The page hits `GET /api/admin/items?status=...&search=...` and shows the unified queue.
2. The detail panel shows the item's photo, metadata, and full match breakdown.
3. Admin clicks **Approve / Flag / Block / Delete** — each maps to a small set of admin endpoints described in §6.9.
4. For matching, admin can adjust the **threshold** and **weights** in the **AI Matching** tab. The settings are written to `adminconfigs` and re-read on every request via `admin/utils/matchingConfig.js`.

---

## 8. Frontend Analysis

### 8.1 Mobile App (`mobile/`) — Expo + expo-router

The mobile app is a **file-based router** (expo-router 6). Each folder under `app/` defines a route segment. The app uses **native** screens (no `expo-router/dom`).

#### Layouts

- `app/_layout.jsx` is the root. It mounts:
  - `SafeScreen` (respects `react-native-safe-area-context` insets).
  - `I18nProvider` (loads persisted language, exposes `t(key, params)`).
  - `ClerkProvider` (publishable key from `app.json` extra).
  - `Slot` from expo-router.
- `app/(auth)/_layout.jsx` is the unauthenticated stack. It redirects signed-in users to `/`.
- `app/(root)/_layout.jsx` is the authenticated stack. It also subscribes to the `banned` event registered by `services/api.js` and renders a ban modal with a sign-out button.

#### Authentication (`app/(auth)/`)

- `sign-in.jsx` and `sign-up.jsx` use Clerk's `useSignIn`/`useSignUp` and `useOAuth({ strategy: 'oauth_google' })`. After Clerk returns a session, they immediately call `POST /api/users` to mirror the user in MongoDB.
- `oauth-native-callback.jsx` is the redirect target for the native OAuth flow. It just shows `PageLoader`.

#### Tabs (`app/(tabs)/`)

- `index.jsx` — Home. Shows greeting, two big CTAs ("I Lost Something" / "I Found Something"), the recent items list, and the user's notification feed. Items are loaded through `lib/cache.js` (which also exports the `tokenCache` for Clerk secure store) and the `services/api.js` axios client.
- `chat.jsx` — Chat list. Uses `services/socket.js` to subscribe to `notification:new` and `message:new`, marks the user as online, and shows the most recent preview per conversation.
- `profile.jsx` — Profile. Avatar picker (`expo-image-picker`), language modal (drives `I18nProvider`), stats summary, sign-out.

#### Modals (`app/(modals)/`)

- `report-lost.jsx` and `report-found.jsx` share the same form hook, `hooks/useItemReportForm.js`, which owns: location permission + current position (`expo-location`), the image upload pipeline (`useImageUpload.js`), validation, and a lazy-loaded `react-native-maps` view. The map falls back to a text input when the package is not yet installed in development builds.
- After submission, the modal shows a success Alert and pops back to the home tab.

#### Chat Conversation (`app/chat-conversation.jsx`)

- Subscribes to `message:new`, `typing:start/stop`, and presence events.
- Renders text messages with read-receipt ticks.

#### Services & Hooks

- `services/api.js` — single axios instance. `getAuthenticatedApi(token, getTokenFn)` attaches a Bearer token and exposes `getItems`, `reportItem`, `uploadTempImage`, `sendMessage`, `deleteItem`, `getMyItems`, `getMatches`, `respondToMatch`, `getNotifications`, `markNotificationRead`, `deleteChat`. A 401 response triggers a token refresh; a 403 with `banned=true` triggers the global ban UI.
- `services/socket.js` — `SocketService` class with `connect`, `disconnect`, `joinChat`, `sendMessage`, `sendTyping`, `markRead`, and listener registration helpers. Uses `socket.io-client`.
- `config/env.js` — reads `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from `app.json` `extra` and throws at startup if they are missing.
- `hooks/useItemReportForm.js` — orchestrates: location permission, reverse geocoding fallback, image upload, suggestions, and form validation. Returns the form state and submit handler.
- `hooks/useImageUpload.js` — `uploadImage(uri, onProgress)` posts to `/api/upload/temp` with `image/jpeg`. Falls back to a simulated 0–100% progress curve if the server doesn't emit progress events.
- `i18n/I18nProvider.jsx` + `i18n/translations.js` — `I18nProvider` provides `t('section.key', {param: 'value'})` for English text lookup.

#### Components

- `components/RecentItemCard.jsx` — list-row with eye/trash buttons. Eye opens a detail modal (location, category, brand, color, description). Trash requires typing the literal word `delete` to confirm.
- `components/BottomNavBar.jsx` — 3-tab nav (Home / Chat / Profile).
- `components/RecentItemsList.jsx` — wrapper that shows a friendly empty state.
- `components/PageLoader.jsx` and `components/SafeScreen.jsx` — utility wrappers.
- `components/SignOutButton.jsx` — confirmation alert then `useClerk().signOut()`.
- `components/AddItemForm.jsx` — an older standalone form, kept for reference but not wired into the main flow.

#### Theme & Config

- `constants/colors.js` defines four themes (coffee, forest, purple, ocean) and exports `COLORS` from the active one. `assets/styles/*.styles.js` files use the same palette directly for module-scoped styles.
- `app.json` declares Expo plugins: `expo-router`, `expo-image-picker`, `expo-location`, `expo-secure-store`, `expo-av`, and configures the dev server with `EXPO_PUBLIC_API_URL` (overwritten by `update-ip.ps1`).

#### Multi-language

Strings are looked up by dotted keys, e.g. `t('report.itemNamePlaceholder')`. The provider supports `{{param}}` interpolation. Languages: `en`, `hi`.

### 8.2 Admin Web (`admin-web/`) — Vite + React

The admin web is a single-page React 19 app styled with hand-rolled CSS (`styles.css`). It uses **Clerk** for auth and **Recharts** for dashboard charts.

#### Entry Point

- `main.jsx` mounts `<ClerkProvider>` and `<App />`. It throws at boot if `VITE_CLERK_PUBLISHABLE_KEY` is missing.
- `App.jsx` holds all client state: the active tab, paginated items/users/matches, the matching config, the selected item/user/institution, the dispute transcript, etc. The seven tabs are:
  1. `Dashboard`
  2. `Moderation`
  3. `Institutions`
  4. `Users`
  5. `Matching` (AI)
  6. `Disputes`
  7. `Settings`

#### Components

- `AuthGate.jsx` — `<SignedOut>` shows a branded sign-in splash with a Clerk `SignInButton`; `<SignedIn>` renders the app shell.
- `Layout.jsx` — fixed left sidebar with the seven nav buttons, brand block, and a security card. Top bar shows the active tab title, the API base URL pill, a notification bell, and a `<UserButton>` for sign-out.
- `ui.jsx` — `PanelTitle`, `AlertRow`, `Badge`, `Info`, `ItemThumb`, `Dial` (recharts pie), `ConfigRange` (range input with label), `EmptyState`.

#### Pages

- `Dashboard.jsx` — four metric cards (active lost, active found, successful returns, open disputes), an area chart for lost-vs-found volume, a usage monitors panel (mock), health alerts (live from `/admin/dashboard/stats`), and a return-efficiency bar chart.
- `Moderation.jsx` — left list with search + status filter; right detail panel with image, AI analysis card, info grid, tag list, and four actions (Approve / Flag / Block / Delete). Quick edit re-PUTs the item with current category/description.
- `Users.jsx` — directory with avatar grid; selected user card shows role, status, reports, claims, karma (computed from status), and three actions (Promote / Flag / Ban toggle).
- `Institutions.jsx` — list of institutions with create/edit form. The form accepts email domains and admin emails as comma/newline-separated text, parses them into lowercased arrays, and POSTs/PUTs to the backend. Each institution card shows member and admin counts, and a refreshable member list.
- `Matching.jsx` — three panels: matches list with score dials (location/title/brand/color), a minimum-threshold slider, and a manual override form (paste lost/found item ids, save, notify users).
- `Disputes.jsx` — chat disputes list with priority badges; selecting one loads its transcript via `GET /api/admin/chats/:id/transcript`. Each transcript is rendered as alternating speaker messages with action buttons.
- `SettingsPanel.jsx` — category manager, AI config sliders (min score + 4 weights), and Cloudinary policy toggles. Saving writes back to `/api/admin/matching/config`.

#### Services

- `services/adminApi.js` — `createAdminApi(getToken)` returns an object with one method per admin endpoint. The `request` helper injects the Clerk JWT and parses JSON. `toQuery` builds `URLSearchParams` while skipping empty values and the literal `"All"`.
- `utils/adminMappers.js` — converts Mongoose docs into the flattened shapes the UI expects (id, title, owner, status, image, etc.). `buildAnalytics` merges the dashboard's item volume and match volume into the chart series.
- `data/mockData.js` — fallback numbers, nav list, and a category list used while real data loads.

---

## 9. Backend Analysis

### 9.1 Process Bootstrap

`backend/src/server.js` is the only entry point.

1. Loads `dotenv` config.
2. Calls `connectDB()` (`config/db.js`).
3. Calls `startCron()` (self-ping every 14 minutes) and `startTempImageCleanup()` (only in production, every 30 minutes).
4. Creates an HTTP server, attaches Socket.io with Clerk auth, and starts `app` (`config/socket.js`).
5. Listens on `process.env.PORT || 5001`.

`backend/src/app.js` registers global middleware (CORS, JSON body parser, request logger), mounts all route modules under `/api`, and exposes `GET /api/health`.

### 9.2 Middleware

- `middleware/clerkAuth.js` — `requireAuth`:
  1. Reads `Authorization: Bearer <token>`.
  2. Calls `clerkClient.verifyToken(token)`.
  3. `getOrCreateUser` from `utils/userSync.js` to mirror the user in Mongo.
  4. Attaches `req.user`.
  5. Throws 401 if the token is invalid, 403 if the user is `BANNED`.
- `middleware/upload.js` — `multer.diskStorage` to `backend/temp/`, and a Cloudinary storage variant. Files are deleted from disk after the AI detection call.
- `admin/middleware/adminAuth.middleware.js` — `requireAdmin`:
  1. Calls `requireAuth` first.
  2. Reads `publicMetadata.role` from the verified token.
  3. Falls back to the Mongo `user.role` field.
  4. Throws 403 if neither is `admin`.

### 9.3 Models (Mongoose)

All seven Mongoose models live in `backend/src/models/`. They use:

- Pre-save hooks (chat enforces two participants).
- Custom validators (item brand-name regex, image-extension regex, etc.).
- Compound indexes for high-frequency queries.
- GeoJSON points for location.

The admin config is stored as a single document with `key: 'matching'`, allowing future keys (e.g. abuse thresholds) to be added without schema migrations.

### 9.4 Routes and Controllers

Each route file in `backend/src/routes/` is a thin wrapper around its controller. Controllers are grouped by feature:

- `controllers/items.js` — create / list / update / delete + status transitions. After every create or relevant update, it calls `matchingController.autoMatchNewItem`.
- `controllers/matching.js` — `autoMatchNewItem` (the workhorse), `findMatches`, and a `respond` handler. The auto-match flow:
  1. Pulls the opposite-type candidates within 20 km (`MIN_MATCH_SCORE = 40`).
  2. For each candidate, calls `services/geminiMatching.js` (Gemini) for a 0–100 score.
  3. If Gemini is unavailable, falls back to the deterministic rule-based scorer (`scoreCandidatesWithRuleFallback`) in the same controller.
  4. Computes weighted scores using the live `matchingConfig` from `admin/utils/matchingConfig.js`.
  5. Persists `MatchedItem` for each pair above threshold, sends a `Notification` to both users, and emits a Socket.io event.
- `controllers/chat.js` — `getOrCreateChat`, list, send text, delete.
- `controllers/notifications.js` — paginated read, mark single/all read, delete.
- `controllers/institutions.js` — public read endpoints, scoped by membership.

### 9.5 Services

- `services/geminiMatching.js` — formats a JSON-only prompt for `gemini-2.5-flash`, returns a `matchScore` 0–100 plus per-axis scores. Helpers: `clamp`, `parseJsonFromText` (handles code-fenced JSON in Gemini responses).

### 9.6 Real-time Layer

`backend/src/config/socket.js` exports a function that:

1. Reads the JWT from the handshake `auth.token` (or `Authorization` header).
2. Verifies it with Clerk.
3. Stores `socket.data.user = { id, name }`.
4. Maintains a `connectedUsers` Map for presence.
5. Wires events: `user:join`, `chat:join`, `message:send`, `typing:start`, `typing:stop`, `message:read`.

Server-side it persists messages, updates `unreadCount` on the chat, and emits `message:new` to the room.

### 9.7 Scheduled Jobs

- `config/cron.js` — every 14 minutes, fetches `${process.env.API_URL || 'http://127.0.0.1:5001'}/api/health` to keep free-tier hosts warm.
- `config/tempImageCleanup.js` — every 30 minutes, lists Cloudinary resources in `reclaimit/temp` older than 1 hour that are not referenced by any Item, then destroys them. Only runs when `NODE_ENV=production`.

### 9.8 Admin Module

- `admin/routes.js` mounts everything under `/api/admin`. Each route is `requireAuth` + `requireAdmin` then the controller method.
- `admin/controllers/dashboard.controller.js` aggregates counts with `Promise.all` over the relevant collections and adds a `health` object that powers the admin alert card.
- `admin/controllers/items.controller.js` adds pagination, free-text search across `itemName`, `description`, `location.name`, and overrides status with audit-friendly reason notes.
- `admin/controllers/users.controller.js` returns reportCount/claimCount by aggregating over the items collection.
- `admin/controllers/matching.controller.js` returns all matches (most recent first), exposes the manual override endpoint, and the config GET/PUT.
- `admin/controllers/institutions.controller.js` is the most feature-rich: create/update with normalized email lists, soft-archive, restore, and member listing.
- `admin/controllers/chats.controller.js` lists "dispute" chats (status = blocked, or any chat with messages) and exposes a flat transcript endpoint for the audit viewer.
- `admin/models/adminConfig.model.js` is the key/value store.
- `admin/utils/matchingConfig.js` reads/writes the config with sensible defaults (`minimumScore = 70`, weights `45/30/15/10`).
- `admin/utils/constants.js` defines `getMatchStrength(score)` (70/50 cut-off) and other enums.

---

## 10. Security & Validation

| Concern                | How ReclaimIt handles it                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication         | All clients use**Clerk** (hosted). The backend never stores passwords. JWTs are verified on every request via `@clerk/clerk-sdk-node` (`clerkAuth.js`).                                                                                     |
| Authorization          | `requireAuth` gates every non-public route. `requireAdmin` (in `admin/middleware/adminAuth.middleware.js`) checks `publicMetadata.role` first, then falls back to the Mongo user, ensuring both Clerk metadata and DB are aligned.            |
| Banning                | When an admin sets a user to `BANNED`, the next request fails `requireAuth` with HTTP 403. The mobile API client's response interceptor (`services/api.js`) detects `banned: true` and triggers a global ban modal that only offers sign-out. |
| Data loss prevention   | `tempImageCleanup.js` cron job prevents orphaned Cloudinary objects. The HTTP keep-alive ping in `cron.js` keeps the backend alive on free-tier hosts.                                                                                            |
| File size              | Multer's disk storage is bounded by the request body parser limits. Image-extension regex on the Item model rejects unexpected file types.                                                                                                            |
| CORS                   | Configured centrally in `app.js` to allow the admin web origin and the mobile dev server.                                                                                                                                                           |
| Body limits            | `express.json` is left at default for routes; multer handles multipart bodies.                                                                                                                                                                      |
| Secrets                | All secrets live in `backend/.env` (Mongo, Clerk, Cloudinary, Gemini). The mobile and admin web only see publishable keys.                                                                                                                          |
| Socket security        | Socket.io handshake is gated by Clerk token verification (`io.use` middleware). Only authenticated users can join chat rooms.                                                                                                                       |
| Admin override         | The `POST /api/admin/matching/override` route allows the admin to force a match even with a 100 score. This is intentionally privileged and only accessible by admins.                                                                              |
| User-generated content | `requireAuth` and ownership checks on item updates/deletes. Admins can override but every change is reflected in the audit log.                                                                                                                     |

---

## 11. Challenges & Design Decisions

### 11.1 Choosing an AI stack

**Decision:** Use cloud **Google Gemini** for semantic matching with a deterministic rule-based fallback. No self-hosted ML models.
**Why:** The product must run on free / cheap infrastructure. Gemini provides broad world knowledge and handles noisy, real-world free-text descriptions out of the box with zero training pipeline and zero serving infrastructure. When Gemini is unavailable (missing API key, API outage), the rule-based scorer keeps matching functional.

### 11.2 Gemini provider with rule-based fallback

**Decision:** `MATCH_PROVIDER=gemini` by default, calling Gemini for every candidate. If Gemini is unavailable, the deterministic rule-based scorer takes over.
**Why:** Gemini gives the highest-quality matches for noisy free text. The rule-based fallback guarantees the pipeline never crashes or silently fails — matching just becomes less accurate until Gemini recovers.

### 11.3 Auth in three different runtimes

**Decision:** Centralize auth in Clerk and only ever store `clerkId` in our own database.
**Why:** Implementing secure auth in Express, Expo, and Vite is a maintenance burden. Clerk gives OAuth, MFA, and JWTs out of the box, and `getOrCreateUser` keeps our `User` collection in sync.

### 11.4 Geo-aware matching

**Decision:** Score with a Haversine distance fed into the Gemini prompt (and included in the rule-based fallback weights).
**Why:** A 95%-text match is meaningless if the items are 500 km apart. Distance is the strongest single signal of a real match.

### 11.5 Single-port dev environment

**Decision:** Three services on three ports (5001, 5173, 8081) orchestrated by `start-dev.bat`.
**Why:** Each service has a different runtime and a different startup time; splitting them keeps every log visible in its own terminal pane.

### 11.6 Image upload → Cloudinary

**Decision:** Push the image to a Cloudinary `temp/` folder first, then move it to the permanent `reclaimit/items` folder.
**Why:** Rejected or abandoned uploads never occupy permanent storage. The cron job in `tempImageCleanup.js` is the safety net for the few images that never reach the final folder.

### 11.7 Cloud LLM over a locally-trained model

**Decision:** Use hosted Gemini rather than a self-trained sentence model.
**Why:** No public lost-and-found corpus exists at scale for training, and a self-hosted model adds a Python service, GPU/CPU serving, and retraining overhead. Gemini gives strong semantic reasoning immediately, with zero model-serving infrastructure. The main costs — per-call latency and API bill — are acceptable because the candidate pool per report is capped (100).

### 11.8 Single-language backend stack

**Decision:** One language in the backend (Node.js). All AI is external (Gemini over HTTPS).
**Why:** Keeping the whole orchestrator in TypeScript/JS simplifies deployment, dependency management, and debugging. External AI reduces the backend to a thin HTTP gateway, so there is no need to run Python microservices alongside Node.

### 11.9 Socket.io + REST coexistence

**Decision:** Real-time features (chat, typing, presence) ride on Socket.io; everything else uses REST.
**Why:** The mobile app needs to subscribe to `message:new` and `notification:new` without polling, but the rest of the surface is one-shot request/response where REST is simpler.

### 11.10 Runtime-tunable matching

**Decision:** Store the threshold and weights in `adminconfigs.matching` and have the controller read them on every call.
**Why:** Tuning is empirical — an admin should be able to nudge weights without redeploying.

---

## 12. Scalability & Future Enhancements

### 12.1 What already scales well

- **Stateless Node backend** — multiple instances behind a load balancer; Socket.io can be moved to the Redis adapter when needed.
- **MongoDB** — horizontal scale via replica set / sharding; geo-index on items scales with the standard Mongo geo operators.
- **AI matching** — Gemini is a managed API; load scales automatically and there is nothing to provision or scale ourselves.

### 12.2 Concrete next steps

1. **Push notifications** — integrate Expo Push or FCM so users get notified even when the app is closed.
2. **Edge-based geo search** — Mongo `2dsphere` index + `$geoNear` for "items near me" feeds.
3. **Per-tenant config** — institutions can override the matching threshold to tune for their campus size.
4. **Improve rule-based fallback** — once a corpus of confirmed matches exists, tune the field weights (Jaccard, category, color, brand, time, distance) using real verifications.
5. **Reintroduce AI image analysis** — a future image-similarity feature (e.g., CLIP embeddings) could be added behind the upload endpoint to rank photos visually.
6. **On-device matching** — the mobile app can pre-rank candidates using a small embedding model, only sending the top-K to the backend. This cuts the per-report cost dramatically.
7. **Audit log** — persist every admin action (who changed what, when) into a dedicated `audit_logs` collection for compliance.
8. **SSO for institutions** — add SAML / OIDC connectors for universities that already run their own identity provider.
9. **Additional language support** — the dataset is currently English-only. Adding other language descriptions would improve recall for wider audiences.
10. **Public REST API** — once auth is stable, expose a documented v1 REST API for partner integrations (e.g. campus security systems).

---

## 13. Deployment

### 13.1 Local Development

1. Install Node 20+.
2. **Backend**
   ```bash
   cd backend
   npm install
   npm run dev    # nodemon src/server.js
   ```
3. **Admin Web**
   ```bash
   cd admin-web
   npm install
   npm run dev
   ```
4. **Mobile App**
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
5. Or, on Windows, run `start-dev.bat` from the project root to open all three in separate terminal panes. `update-ip.ps1` will rewrite `mobile/app.json` with the laptop's current WiFi IPv4 so Expo Go on a physical device can reach the backend.

### 13.2 Production Targets

- **Backend** — any Node host (Render, Railway, Fly, AWS ECS). Set `NODE_ENV=production` so the temp-cleanup cron activates. Provide env vars: `MONGODB_URL`, Clerk keys, Cloudinary keys, `GEMINI_API_KEY`, `MATCH_PROVIDER`, `API_URL`.
- **Admin web** — static build (`npm run build` → `dist/`) on Cloudflare Pages, Vercel, or Netlify. Configure `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL`.
- **Mobile** — Expo EAS Build for both stores; configure `eas.json` to point at the production API URL.

### 13.3 Observability

- The backend logs to stdout. A free-tier **PM2** or `systemd` service can be used for restarts.
- The cron keep-alive ping also serves as a basic liveness signal.
- The admin Dashboard's "Health alerts" panel shows database / Cloudinary / Gemini status in real time.

### 13.4 Environment Cheat-Sheet

| Service                    | Port | URL                              |
| -------------------------- | ---- | -------------------------------- |
| Backend (HTTP + Socket.io) | 5001 | `http://localhost:5001/api`    |
| Admin Web (Vite)           | 5173 | `http://localhost:5173`        |
| Mobile (Expo)              | 8081 | `http://<laptop-ip>:8081`      |

---

## 14. Conclusion

ReclaimIt is a **production-shaped, AI-first** lost-and-found platform. It is intentionally built as a small set of loosely coupled services so each layer can evolve independently:

- The **mobile app** is a fast, accessible Expo experience that handles sign-in, image capture, geolocation, and real-time chat.
- The **backend** is a thin Node API that owns persistence, authentication, and orchestration of all AI calls. It is small enough to reason about end-to-end and rich enough to demonstrate real engineering concerns (cron jobs, file uploads, cloud AI integration, real-time sockets, RBAC, audit endpoints).
- The **admin web** showcases the same data from a moderator's perspective and proves that the system is operable, not just a demo.
- **Matching intelligence** is delivered by Google Gemini through the backend, with a deterministic rule-based fallback so the pipeline never depends on a single provider.

### 14.1 What this demonstrates

- Full-stack engineering across Node, React, and React Native.
- Production patterns: env-based config, scheduled jobs, RBAC, file uploads, real-time comms, graceful degradation.
- Applied AI: a cloud LLM (Gemini) wired into a real product for semantic item matching, with an explainable rule-based fallback.
- Thoughtful UX: ban flow, manual admin override.

### 14.2 What to try first

1. **Sign in** with Google on the mobile app, report a lost item with a real photo, then report a similar found item from another account and watch the chat open in real time.
2. **Open the admin portal** in a browser, sign in with an admin Clerk account, and watch the moderation queue populate.
3. **Watch the backend logs** while a report is created — the `autoMatchNewItem` flow will log each candidate's Gemini score and the resulting match strength.

The codebase is intentionally readable: every folder has a clear single responsibility, every service has a one-line README, and the cross-service contracts are visible in the controllers and route definitions. A new contributor should be able to land a meaningful change in their first afternoon.

---

*Documentation generated by reading the source. All file references use the format `path:line` for direct navigation inside the repository.*
