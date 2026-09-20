import { t } from '../domain/language.js';
export const getApiError = (error) => t(error?.response?.data?.message || 'Request failed');
