export const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

async function request(path, { getToken, method = "GET", body } = {}) {
  const token = await getToken();
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function createAdminApi(getToken) {
  return {
    getDashboardStats: () => request("/admin/dashboard/stats", { getToken }),
    getDashboardAnalytics: () => request("/admin/dashboard/analytics?days=14", { getToken }),

    getItems: (params = {}) => request(`/admin/items${toQuery(params)}`, { getToken }),
    updateItemStatus: (id, status) => request(`/admin/items/${id}/status`, { getToken, method: "PUT", body: { status } }),
    updateItem: (id, body) => request(`/admin/items/${id}`, { getToken, method: "PUT", body }),
    deleteItem: (id) => request(`/admin/items/${id}`, { getToken, method: "DELETE" }),

    getUsers: (params = {}) => request(`/admin/users${toQuery(params)}`, { getToken }),
    updateUserBan: (id, banned) => request(`/admin/users/${id}/ban`, { getToken, method: "PUT", body: { banned } }),
    updateUserRole: (id, role) => request(`/admin/users/${id}/role`, { getToken, method: "PUT", body: { role } }),
    updateUserStatus: (id, status) => request(`/admin/users/${id}/status`, { getToken, method: "PUT", body: { status } }),

    getMatches: (params = {}) => request(`/admin/matching/matches${toQuery(params)}`, { getToken }),
    createManualOverride: (body) => request("/admin/matching/override", { getToken, method: "POST", body }),
    getMatchingConfig: () => request("/admin/matching/config", { getToken }),
    updateMatchingConfig: (body) => request("/admin/matching/config", { getToken, method: "PUT", body }),

    getDisputes: (params = {}) => request(`/admin/chats/disputes${toQuery(params)}`, { getToken }),
    getTranscript: (id) => request(`/admin/chats/${id}/transcript`, { getToken }),

    getInstitutions: (params = {}) => request(`/admin/institutions${toQuery(params)}`, { getToken }),
    createInstitution: (body) => request("/admin/institutions", { getToken, method: "POST", body }),
    getInstitution: (id) => request(`/admin/institutions/${id}`, { getToken }),
    updateInstitution: (id, body) => request(`/admin/institutions/${id}`, { getToken, method: "PUT", body }),
    archiveInstitution: (id) => request(`/admin/institutions/${id}`, { getToken, method: "DELETE" }),
    restoreInstitution: (id) => request(`/admin/institutions/${id}/restore`, { getToken, method: "POST" }),
    getInstitutionMembers: (id, params = {}) => request(`/admin/institutions/${id}/members${toQuery(params)}`, { getToken }),

    getAdminUser: () => request("/admin/me", { getToken }),
  };
}

function toQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "All") {
      query.set(key, value);
    }
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}
