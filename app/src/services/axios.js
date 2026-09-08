import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_SERVER || "",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rental-book-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("rental-book-token");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export default api;
