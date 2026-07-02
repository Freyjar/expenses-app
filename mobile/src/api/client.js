const BASE_URL = "https://expenses.freyjar.site";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw { status: 401, message: "Unauthorized" };
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username, password) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request("/api/logout", { method: "POST" }),

  me: () => request("/api/me"),

  // Expenses
  getExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/expenses?${query}`);
  },

  addExpense: (data) =>
    request("/api/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),

  updateNote: (id, note) =>
    request(`/api/expenses/${id}/note`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),

  // Summary & Stats
  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/summary?${query}`);
  },

  getStats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/stats?${query}`);
  },
};
