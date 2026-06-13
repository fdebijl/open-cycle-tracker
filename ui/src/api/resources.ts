import { api } from './client';
import type { CategoryDto, CategoryLevelDto, CycleDto, DayDto, FactorDto, UserDto } from './types';

export interface UserWritePayload {
  email?: string | null;
  encName?: string | null;
  encInfo?: string | null;
  encSettings?: string | null;
}

export const usersApi = {
  get: (id: string) => api.get<UserDto>(`/users/${id}`),
  update: (id: string, body: UserWritePayload) => api.patch<UserDto>(`/users/${id}`, body),
  remove: (id: string) => api.del<void>(`/users/${id}`),
};

/**
 * Thin wrappers over the resource endpoints. Bodies carry encrypted fields as
 * base64; the data layer (`src/data/`) handles encrypt/decrypt around these.
 */

export const cyclesApi = {
  list: () => api.get<CycleDto[]>('/cycles'),
  get: (id: string) => api.get<CycleDto>(`/cycles/${id}`),
  create: () => api.post<CycleDto>('/cycles'),
  remove: (id: string) => api.del<void>(`/cycles/${id}`),
};

export interface DayWritePayload {
  cycleId?: string;
  encDate?: string;
  encDayType?: string;
  order?: number | null;
}

export const daysApi = {
  list: () => api.get<DayDto[]>('/days'),
  get: (id: string) => api.get<DayDto>(`/days/${id}`),
  create: (body: DayWritePayload) => api.post<DayDto>('/days', body),
  update: (id: string, body: DayWritePayload) => api.patch<DayDto>(`/days/${id}`, body),
  remove: (id: string) => api.del<void>(`/days/${id}`),
};

export interface FactorWritePayload {
  dayId?: string;
  categoryLevelId?: string;
  encNotes?: string | null;
}

export const factorsApi = {
  list: () => api.get<FactorDto[]>('/factors'),
  get: (id: string) => api.get<FactorDto>(`/factors/${id}`),
  create: (body: FactorWritePayload) => api.post<FactorDto>('/factors', body),
  update: (id: string, body: FactorWritePayload) => api.patch<FactorDto>(`/factors/${id}`, body),
  remove: (id: string) => api.del<void>(`/factors/${id}`),
};

export const categoriesApi = {
  list: () => api.get<CategoryDto[]>('/categories'),
  get: (id: string) => api.get<CategoryDto>(`/categories/${id}`),
};

export const categoryLevelsApi = {
  // Note the underscore path (the API mounts this router at /category_levels).
  list: () => api.get<CategoryLevelDto[]>('/category_levels'),
  get: (id: string) => api.get<CategoryLevelDto>(`/category_levels/${id}`),
};
