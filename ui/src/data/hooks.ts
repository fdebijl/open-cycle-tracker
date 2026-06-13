import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVault } from '@/stores/vault';
import { categoriesApi, categoryLevelsApi, cyclesApi, daysApi, factorsApi, usersApi } from '@/api/resources';
import {
  decryptAll,
  decryptCategory,
  decryptCategoryLevel,
  decryptDay,
  decryptFactor,
  decryptSettings,
  encryptDayFields,
  encryptSettings,
} from './mappers';
import { encryptString } from '@/crypto';
import type { Cycle, Day, DayType, UserSettings } from './types';

/**
 * Server state via TanStack Query. Each query fetches DTOs then decrypts them
 * with the in-memory DEK, so components only ever see plaintext domain models.
 * Queries are keyed by user id and gated on an unlocked vault.
 */

function useDek(): Uint8Array | null {
  return useVault((s) => s.dek);
}

function useUserId(): string | undefined {
  return useVault((s) => s.session?.user.id);
}

// ---- Queries -------------------------------------------------------------

export function useCycles() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['cycles', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Cycle[]> => {
      const dtos = await cyclesApi.list();
      // Newest first — the latest cycle is treated as the current one.
      return [...dtos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}

/** All of the user's days (the API has no per-cycle filter), decrypted. */
export function useDays() {
  const dek = useDek();
  const userId = useUserId();
  return useQuery({
    queryKey: ['days', userId],
    enabled: !!dek && !!userId,
    queryFn: async (): Promise<Day[]> => {
      const dtos = await daysApi.list();
      return decryptAll(dtos, dek!, decryptDay);
    },
  });
}

/** A single day with its factors decrypted (GET /days/:id includes factors). */
export function useDay(id: string | undefined) {
  const dek = useDek();
  const userId = useUserId();
  return useQuery({
    queryKey: ['day', userId, id],
    enabled: !!dek && !!userId && !!id,
    queryFn: async () => {
      const dto = await daysApi.get(id!);
      const day = await decryptDay(dto, dek!);
      const factors = await decryptAll(dto.factors ?? [], dek!, decryptFactor);
      return { ...day, factors };
    },
  });
}

export function useCategories() {
  const dek = useDek();
  const userId = useUserId();
  return useQuery({
    queryKey: ['categories', userId],
    enabled: !!dek && !!userId,
    queryFn: async () => decryptAll(await categoriesApi.list(), dek!, decryptCategory),
  });
}

export function useCategoryLevels() {
  const dek = useDek();
  const userId = useUserId();
  return useQuery({
    queryKey: ['categoryLevels', userId],
    enabled: !!dek && !!userId,
    queryFn: async () => decryptAll(await categoryLevelsApi.list(), dek!, decryptCategoryLevel),
  });
}

/** The user's decrypted preferences (e.g. average cycle length). */
export function useUserSettings() {
  const dek = useDek();
  const userId = useUserId();
  return useQuery({
    queryKey: ['settings', userId],
    enabled: !!dek && !!userId,
    queryFn: async (): Promise<UserSettings> => decryptSettings(await usersApi.get(userId!), dek!),
  });
}

// ---- Mutations -----------------------------------------------------------

/** Persist the user's preferences (encrypted). */
export function useUpdateSettings() {
  const dek = useDek();
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: UserSettings): Promise<UserSettings> => {
      if (!dek || !userId) throw new Error('Vault is locked');
      const encSettings = await encryptSettings(settings, dek);
      await usersApi.update(userId, { encSettings });
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', userId] });
    },
  });
}

/**
 * Start a new cycle anchored at a period onset: create the cycle, then create
 * its first day (the onset) as a `period` day on that date. Used at onboarding,
 * by the no-cycle fallback, and by "start a new period". Cycle length derives
 * client-side from onset-to-onset, so nothing else is pre-populated.
 */
export function useStartCycle() {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { onset: Date }) => {
      if (!dek) throw new Error('Vault is locked');
      const cycle = await cyclesApi.create();
      const enc = await encryptDayFields({ date: input.onset, dayType: 'period' }, dek);
      const day = await daysApi.create({ cycleId: cycle.id, encDate: enc.encDate, encDayType: enc.encDayType });
      return { cycle, day };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
      queryClient.invalidateQueries({ queryKey: ['days', userId] });
    },
  });
}

/** Log a day on an arbitrary date (on-demand, e.g. tapping a blank calendar
 * cell or an empty slot on the circle). Returns the created day so the caller
 * can navigate to its tracker. */
export function useLogDay() {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { date: Date; cycleId: string; dayType?: DayType }) => {
      if (!dek) throw new Error('Vault is locked');
      const enc = await encryptDayFields({ date: input.date, dayType: input.dayType ?? 'none' }, dek);
      return daysApi.create({ cycleId: input.cycleId, encDate: enc.encDate, encDayType: enc.encDayType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['days', userId] });
    },
  });
}

export function useUpdateDay() {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { id: string; date?: Date; dayType?: DayType }) => {
      if (!dek) throw new Error('Vault is locked');
      const enc = await encryptDayFields({ date: input.date, dayType: input.dayType }, dek);
      return daysApi.update(input.id, enc);
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['days', userId] });
      queryClient.invalidateQueries({ queryKey: ['day', userId, id] });
    },
  });
}

export function useCreateFactor() {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { dayId: string; categoryLevelId: string; notes?: string }) => {
      const encNotes = input.notes && dek ? await encryptString(input.notes, dek) : undefined;
      return factorsApi.create({ dayId: input.dayId, categoryLevelId: input.categoryLevelId, encNotes });
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: ['day', userId, dayId] });
    },
  });
}

export function useDeleteFactor(dayId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (factorId: string) => factorsApi.remove(factorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day', userId, dayId] });
    },
  });
}
