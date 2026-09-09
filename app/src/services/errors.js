import { t } from '../domain/language';
export const getApiError = (error) => t(error?.response?.data?.message || 'Request failed');
