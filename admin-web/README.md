# ReclaimIt - Admin Web Portal (Frontend)

This is the frontend dashboard for ReclaimIt administrators. It provides a secure, web-based interface for content moderation, system health monitoring, user management, and AI matching analytics.

## 🛠️ Technology Stack
* **Framework**: React.js (Vite)
* **Styling**: TailwindCSS & Lucide Icons (or custom CSS)
* **Authentication**: Clerk React SDK (`@clerk/clerk-react`)
* **Charts/Analytics**: Recharts (or Chart.js)
* **HTTP Client**: Axios

---

## 🚀 Key Modules & Features

### 1. 📊 Dashboard & Metrics
* **Real-Time KPIs**: Counters displaying total active lost/found items, successful returns, active chats, and unresolved disputes.
* **Activity Graphs**: Interactive line/bar charts showing lost vs. found report volume trends.
* **Usage Monitors**: Tracking Gemini API token consumption and Cloudinary storage alerts.

### 2. 🛡️ Moderation Queue
* **Unified Item Grid**: Searchable, paginated table of all items reported.
* **Moderation Card**: Popup details showing item images, map location coordinates, description, and owner profile.
* **Actions**:
  * **Approve / Flag / Block**: Flags suspicious descriptions; deletes spam.
  * **Quick Edit**: Adjust categories or item tags directly to feed better data back into the AI matching engine.

### 3. 👥 User Management
* **User Directory**: Search and filter options for all registered platform users.
* **User Card**: Detailed view of user activity history (reports, active claims, karma trust points).
* **Administrative Controls**: Promote to Admin, Flag Account, or Ban/Unban buttons.

### 4. 🧠 AI Matching Auditor
* **AI Matches List**: Monitor pairs matched by the Gemini backend.
* **Scoring breakdown visual**: Circular progress dials detailing exact parameters matching (Location: 90%, Title: 70%, Brand: 0%).
* **Manual Override Tool**: Option to manually link an owner's lost item to a finder's item when requested by support.

### 5. 💬 Chat & Dispute Resolution
* **Reported Chats Feed**: High-priority listing of messages flagged by users.
* **Audit Viewer**: Read-only transcript of flagged chats between users to arbitrate claims/scams or enforce bans.

### 6. ⚙️ Platform Settings
* **Category Manager**: Add, update, or hide categories and tags.
* **AI Configuration**: Sliders to adjust minimum matching threshold scores.

---

## 🚦 Getting Started

### 1. Setup Environment
Create a `.env` file in the root directory:
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:5001/api
```

### 2. Installation
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
