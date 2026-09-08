import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_SERVER || "",
  timeout: 15000,
});

export default api;
