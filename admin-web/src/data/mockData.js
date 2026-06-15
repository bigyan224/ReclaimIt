import {
  Activity,
  AlertTriangle,
  Brain,
  Building2,
  Check,
  LayoutDashboard,
  MessageSquareWarning,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";

export const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "moderation", label: "Moderation", icon: Shield },
  { id: "institutions", label: "Institutions", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "matching", label: "AI Matching", icon: Brain },
  { id: "disputes", label: "Disputes", icon: MessageSquareWarning },
  { id: "settings", label: "Settings", icon: Settings },
];

export const analytics = [
  { day: "Mon", lost: 42, found: 35, returned: 12 },
  { day: "Tue", lost: 49, found: 44, returned: 17 },
  { day: "Wed", lost: 38, found: 52, returned: 19 },
  { day: "Thu", lost: 61, found: 56, returned: 24 },
  { day: "Fri", lost: 72, found: 64, returned: 31 },
  { day: "Sat", lost: 58, found: 73, returned: 29 },
  { day: "Sun", lost: 47, found: 59, returned: 25 },
];

export const categories = ["Electronics", "Documents", "Bags", "Keys", "Jewelry", "Clothing", "Cards"];

export const stats = [
  { label: "Active lost", value: 428, delta: "+12 today", icon: Search, tone: "blue" },
  { label: "Active found", value: 391, delta: "+18 today", icon: Check, tone: "teal" },
  { label: "Successful returns", value: 1264, delta: "+31 week", icon: Activity, tone: "green" },
  { label: "Open disputes", value: 18, delta: "6 urgent", icon: AlertTriangle, tone: "amber" },
];

export const initialItems = [
  {
    id: "ITM-1048",
    title: "Black Samsung Galaxy S24",
    type: "Lost",
    category: "Electronics",
    status: "ACTIVE",
    owner: "Aarav Sharma",
    location: "Durbar Marg, Kathmandu",
    coords: "27.7120, 85.3168",
    age: "18 min",
    risk: "Medium",
    image: "phone",
    description: "Lost near the cafe counter. Has a cracked transparent case and a blue SIM tray.",
    tags: ["phone", "black", "samsung"],
  },
  {
    id: "ITM-1047",
    title: "Brown leather wallet",
    type: "Found",
    category: "Documents",
    status: "FLAGGED",
    owner: "Maya Gurung",
    location: "Pulchowk Engineering Campus",
    coords: "27.6822, 85.3188",
    age: "41 min",
    risk: "High",
    image: "wallet",
    description: "Finder uploaded ID-like details in public notes. Needs description cleanup before approval.",
    tags: ["wallet", "brown", "id-card"],
  },
  {
    id: "ITM-1046",
    title: "Blue Jansport backpack",
    type: "Lost",
    category: "Bags",
    status: "ACTIVE",
    owner: "Nisha KC",
    location: "Boudha Stupa Gate",
    coords: "27.7215, 85.3618",
    age: "1 hr",
    risk: "Low",
    image: "bag",
    description: "Contains books and a water bottle. Owner says the zipper pull is orange.",
    tags: ["bag", "blue", "jansport"],
  },
  {
    id: "ITM-1045",
    title: "Gold ring with initials",
    type: "Found",
    category: "Jewelry",
    status: "ACTIVE",
    owner: "Suman Rai",
    location: "Patan Museum courtyard",
    coords: "27.6727, 85.3253",
    age: "3 hrs",
    risk: "Medium",
    image: "ring",
    description: "Found after closing time. Initials withheld for claimant verification.",
    tags: ["ring", "gold", "initials"],
  },
];

export const initialUsers = [
  { id: "USR-781", name: "Maya Gurung", email: "maya@example.com", role: "member", status: "Flagged", reports: 11, claims: 3, karma: 72, joined: "Jan 2026" },
  { id: "USR-642", name: "Aarav Sharma", email: "aarav@example.com", role: "member", status: "Active", reports: 7, claims: 2, karma: 88, joined: "Feb 2026" },
  { id: "USR-504", name: "Nisha KC", email: "nisha@example.com", role: "admin", status: "Active", reports: 23, claims: 8, karma: 96, joined: "Nov 2025" },
  { id: "USR-319", name: "Ritesh Lama", email: "ritesh@example.com", role: "member", status: "Banned", reports: 2, claims: 5, karma: 18, joined: "Apr 2026" },
];

export const matches = [
  { id: "MT-2201", lost: "Black Samsung Galaxy S24", found: "Black Android phone in case", owner: "Aarav Sharma", finder: "Prabin Tamang", score: 91, location: 94, title: 88, brand: 100, color: 92, status: "Strong" },
  { id: "MT-2199", lost: "Blue Jansport backpack", found: "Navy backpack at Boudha", owner: "Nisha KC", finder: "Elina Shrestha", score: 76, location: 81, title: 74, brand: 66, color: 84, status: "Review" },
  { id: "MT-2194", lost: "Gold ring with initials", found: "Small gold ring", owner: "Anonymous", finder: "Suman Rai", score: 63, location: 67, title: 62, brand: 0, color: 91, status: "Weak" },
];

export const disputes = [
  {
    id: "DSP-904",
    item: "Brown leather wallet",
    priority: "High",
    reason: "Sensitive ID details posted",
    reporter: "Maya Gurung",
    assigned: "Unassigned",
    messages: [
      ["Finder", "I found this wallet and it has a citizenship card inside."],
      ["Owner", "Please don't post the ID number publicly."],
      ["Finder", "Sorry, I thought it helped verify faster."],
    ],
  },
  {
    id: "DSP-891",
    item: "Black Samsung Galaxy S24",
    priority: "Medium",
    reason: "Claimant asked for payment before return",
    reporter: "Aarav Sharma",
    assigned: "Nisha KC",
    messages: [
      ["Claimant", "Send a service fee first, then I will meet."],
      ["Owner", "Can we verify the IMEI or case mark first?"],
      ["Claimant", "No verification until payment."],
    ],
  },
];

export const usageData = [
  { name: "Gemini", value: 68, color: "#2563eb" },
  { name: "Cloudinary", value: 46, color: "#0f766e" },
  { name: "Socket", value: 31, color: "#d97706" },
];
