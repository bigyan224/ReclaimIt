import React, { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import AuthGate from "./components/AuthGate.jsx";
import Layout from "./components/Layout.jsx";
import { createAdminApi } from "./services/adminApi.js";
import { buildAnalytics, mapDispute, mapInstitution, mapItem, mapMatch, mapTranscript, mapUser } from "./utils/adminMappers.js";
import Dashboard from "./pages/Dashboard.jsx";
import Disputes from "./pages/Disputes.jsx";
import Institutions from "./pages/Institutions.jsx";
import Matching from "./pages/Matching.jsx";
import Moderation from "./pages/Moderation.jsx";
import SettingsPanel from "./pages/SettingsPanel.jsx";
import UserManagement from "./pages/UserManagement.jsx";

const DEFAULT_CONFIG = {
  minimumScore: 70,
  weights: {
    location: 45,
    title: 30,
    brand: 15,
    color: 10,
  },
};

export default function App() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const isMasterAdmin = clerkUser?.publicMetadata?.role === "admin";
  const api = useMemo(() => createAdminApi(getToken), [getToken]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [dashboard, setDashboard] = useState({ stats: null, analytics: [] });
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionStatusFilter, setInstitutionStatusFilter] = useState("All");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null);

  // Fetch admin user role from backend
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const data = await api.getAdminUser();
        setUserInfo(data.user);
      } catch {
        // Non-critical, role detection falls back to Clerk metadata
      }
    })();
  }, [isLoaded, isSignedIn]);

  const activeUserInfo = userInfo || {
    isMasterAdmin,
    isInstitutionAdmin: false,
    institutionIds: [],
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    if (activeTab === "dashboard") loadDashboard();
    if (activeTab === "moderation") loadItems();
    if (activeTab === "institutions") loadInstitutions();
    if (activeTab === "users") loadUsers();
    if (activeTab === "matching") loadMatching();
    if (activeTab === "disputes") loadDisputes();
    if (activeTab === "settings") loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || activeTab !== "moderation") return;
    const timer = window.setTimeout(loadItems, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || activeTab !== "institutions") return;
    const timer = window.setTimeout(loadInstitutions, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionQuery, institutionStatusFilter]);

  async function withLoading(key, task) {
    setLoading((current) => ({ ...current, [key]: true }));
    setError("");

    try {
      return await task();
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  function selectFirstIfNeeded(current, records, setter) {
    if (!current || !records.some((record) => record.id === current.id)) {
      setter(records[0] || null);
    }
  }

  async function loadDashboard() {
    await withLoading("dashboard", async () => {
      const [statsPayload, analyticsPayload] = await Promise.all([api.getDashboardStats(), api.getDashboardAnalytics()]);
      setDashboard({
        stats: statsPayload.stats,
        health: statsPayload.health,
        analytics: buildAnalytics(analyticsPayload.itemVolume, analyticsPayload.matchVolume),
      });
    });
  }

  async function loadItems() {
    await withLoading("items", async () => {
      const payload = await api.getItems({ search: query, status: statusFilter });
      const mapped = (payload.items || []).map(mapItem);
      setItems(mapped);
      selectFirstIfNeeded(selectedItem, mapped, setSelectedItem);
    });
  }

  async function loadUsers() {
    await withLoading("users", async () => {
      const payload = await api.getUsers();
      const mapped = (payload.users || []).map(mapUser);
      setUsers(mapped);
      selectFirstIfNeeded(selectedUser, mapped, setSelectedUser);
    });
  }

  async function loadMatching() {
    await withLoading("matching", async () => {
      const [matchesPayload, configPayload] = await Promise.all([api.getMatches(), api.getMatchingConfig()]);
      setMatches((matchesPayload.matches || []).map(mapMatch));
      setConfig({ ...DEFAULT_CONFIG, ...(configPayload.config || {}) });
    });
  }

  async function loadConfig() {
    await withLoading("settings", async () => {
      const payload = await api.getMatchingConfig();
      setConfig({ ...DEFAULT_CONFIG, ...(payload.config || {}) });
    });
  }

  async function loadDisputes() {
    await withLoading("disputes", async () => {
      const payload = await api.getDisputes();
      const mapped = (payload.disputes || []).map(mapDispute);
      setDisputes(mapped);
      const next = mapped[0] || null;
      setSelectedDispute(next);
      if (next) await loadTranscript(next.id);
      else setTranscript(null);
    });
  }

  async function loadTranscript(id) {
    await withLoading("transcript", async () => {
      const payload = await api.getTranscript(id);
      setTranscript(mapTranscript(payload));
    });
  }

  async function setItemStatus(id, status) {
    const payload = await withLoading("itemAction", () => api.updateItemStatus(id, status));
    if (!payload?.item) return;
    const mapped = mapItem(payload.item);
    setItems((current) => current.map((item) => (item.id === id ? mapped : item)));
    setSelectedItem(mapped);
  }

  async function removeItem(id) {
    const payload = await withLoading("itemAction", () => api.deleteItem(id));
    if (!payload) return;
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItem((current) => (current?.id === id ? null : current));
  }

  async function quickEditItem(id, patch) {
    const payload = await withLoading("itemAction", () => api.updateItem(id, patch));
    if (!payload?.item) return;
    const mapped = mapItem(payload.item);
    setItems((current) => current.map((item) => (item.id === id ? mapped : item)));
    setSelectedItem(mapped);
  }

  async function updateUser(id, patch) {
    let payload = null;
    if (patch.role) payload = await withLoading("userAction", () => api.updateUserRole(id, patch.role));
    if (patch.status === "BANNED" || patch.status === "ACTIVE") payload = await withLoading("userAction", () => api.updateUserBan(id, patch.status === "BANNED"));
    if (patch.status === "FLAGGED") payload = await withLoading("userAction", () => api.updateUserStatus(id, patch.status));

    if (!payload?.user) return;
    const mapped = mapUser(payload.user);
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...mapped } : user)));
    setSelectedUser((current) => (current?.id === id ? { ...current, ...mapped } : current));
  }

  async function saveConfig(nextConfig) {
    const payload = await withLoading("settings", () => api.updateMatchingConfig(nextConfig));
    if (payload?.config) setConfig({ ...DEFAULT_CONFIG, ...payload.config });
  }

  async function createManualOverride(body) {
    const payload = await withLoading("matching", () => api.createManualOverride(body));
    if (payload?.match) await loadMatching();
  }

  async function loadInstitutions() {
    await withLoading("institutions", async () => {
      const payload = await api.getInstitutions({ search: institutionQuery, status: institutionStatusFilter });
      const mapped = (payload.institutions || []).map(mapInstitution);
      setInstitutions(mapped);
      setSelectedInstitution((current) => {
        if (!current) return mapped[0] || null;
        const refreshed = mapped.find((inst) => inst.id === current.id);
        return refreshed || mapped[0] || null;
      });
    });
  }

  async function loadMembers(id) {
    if (!id) {
      setMembers([]);
      return;
    }
    await withLoading("institutionMembers", async () => {
      const payload = await api.getInstitutionMembers(id, { limit: 100 });
      setMembers(payload.members || []);
    });
  }

  function selectInstitution(institution) {
    setSelectedInstitution(institution);
    setMembers([]);
    if (institution) loadMembers(institution.id);
  }

  function resetInstitutionSelection() {
    setSelectedInstitution(null);
    setMembers([]);
  }

  async function createInstitution(body) {
    const payload = await withLoading("institutionAction", () => api.createInstitution(body));
    if (!payload?.institution) return;
    const mapped = mapInstitution(payload.institution);
    setInstitutions((current) => [mapped, ...current]);
    setSelectedInstitution(mapped);
    setMembers([]);
  }

  async function updateInstitution(id, body) {
    const payload = await withLoading("institutionAction", () => api.updateInstitution(id, body));
    if (!payload?.institution) return;
    const mapped = mapInstitution(payload.institution);
    setInstitutions((current) => current.map((inst) => (inst.id === id ? mapped : inst)));
    setSelectedInstitution(mapped);
  }

  async function archiveInstitution(id) {
    const payload = await withLoading("institutionAction", () => api.archiveInstitution(id));
    if (!payload?.institution) return;
    const mapped = mapInstitution(payload.institution);
    setInstitutions((current) => current.map((inst) => (inst.id === id ? mapped : inst)));
    setSelectedInstitution((current) => (current?.id === id ? mapped : current));
  }

  async function restoreInstitution(id) {
    const payload = await withLoading("institutionAction", () => api.restoreInstitution(id));
    if (!payload?.institution) return;
    const mapped = mapInstitution(payload.institution);
    setInstitutions((current) => current.map((inst) => (inst.id === id ? mapped : inst)));
    setSelectedInstitution((current) => (current?.id === id ? mapped : current));
  }

  return (
    <AuthGate>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {error && <div className="error-banner">{error}</div>}
        {activeTab === "dashboard" && <Dashboard dashboard={dashboard} loading={loading.dashboard} userInfo={activeUserInfo} />}
        {activeTab === "moderation" && (
          <Moderation
            filteredItems={items}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            setItemStatus={setItemStatus}
            removeItem={removeItem}
            quickEditItem={quickEditItem}
            loading={loading.items || loading.itemAction}
            userInfo={activeUserInfo}
          />
        )}
        {activeTab === "users" && (
          <UserManagement users={users} selectedUser={selectedUser} setSelectedUser={setSelectedUser} updateUser={updateUser} loading={loading.users || loading.userAction} userInfo={activeUserInfo} />
        )}
        {activeTab === "institutions" && (
          <Institutions
            institutions={institutions}
            selectedInstitution={selectedInstitution}
            members={members}
            membersLoading={loading.institutionMembers}
            loading={loading.institutions || loading.institutionAction}
            query={institutionQuery}
            setQuery={setInstitutionQuery}
            statusFilter={institutionStatusFilter}
            setStatusFilter={setInstitutionStatusFilter}
            selectInstitution={selectInstitution}
            createInstitution={createInstitution}
            updateInstitution={updateInstitution}
            archiveInstitution={archiveInstitution}
            restoreInstitution={restoreInstitution}
            loadMembers={loadMembers}
            resetSelection={resetInstitutionSelection}
            error={error}
            userInfo={activeUserInfo}
          />
        )}
        {activeTab === "matching" && (
          <Matching
            matches={matches}
            config={config}
            setConfig={setConfig}
            saveConfig={saveConfig}
            createManualOverride={createManualOverride}
            loading={loading.matching}
            userInfo={activeUserInfo}
          />
        )}
        {activeTab === "disputes" && (
          <Disputes
            disputes={disputes}
            transcript={transcript}
            selectedDispute={selectedDispute}
            setSelectedDispute={setSelectedDispute}
            loadTranscript={loadTranscript}
            loading={loading.disputes || loading.transcript}
            userInfo={activeUserInfo}
          />
        )}
        {activeTab === "settings" && <SettingsPanel config={config} setConfig={setConfig} saveConfig={saveConfig} loading={loading.settings} userInfo={activeUserInfo} />}
      </Layout>
    </AuthGate>
  );
}
