export const getApiError = (error) =>
  error?.response?.data?.message || error?.message || "Unexpected request error";
