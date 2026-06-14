import { useMemo } from 'react';
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
import type { FactorWritePayload } from '@/api/resources';
import type { FactorDto } from '@/api/types';
import { computePeriodDayIds, flowPeriodLevelIds, FLOW_PERIOD_MIN_ORDER, FLOW_SLUG } from './cycles';
import type { Cycle, Day, UserSettings } from './types';

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
      // Newest first - the latest cycle is treated as the current one.
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

/**
 * All of the user's factors as RAW DTOs. `categoryLevelId` is plaintext, so we
 * deliberately don't decrypt: this query exists to derive cycle onset from
 * logged Flow factors (see `computePeriodDayIds`), which needs only ids. It's
 * therefore not gated on the DEK.
 */
export function useFactors() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['factors', userId],
    enabled: !!userId,
    queryFn: (): Promise<FactorDto[]> => factorsApi.list(),
  });
}

/**
 * The set of day ids that count as period (onset) days - those carrying a Flow
 * factor of intensity ≥ Light. Joins the raw factors with the Flow category's
 * levels client-side. Empty while loading, which makes onset degrade to the
 * earliest dated day rather than break. Shared by the circle, calendar and info.
 */
export function usePeriodDayIds(): Set<string> {
  const factors = useFactors();
  const categories = useCategories();
  const levels = useCategoryLevels();
  return useMemo(() => {
    const flowLevels = flowPeriodLevelIds(categories.data ?? [], levels.data ?? []);
    return computePeriodDayIds(factors.data ?? [], flowLevels);
  }, [factors.data, categories.data, levels.data]);
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
 * The default Flow level for a freshly-started period: the lowest intensity that
 * still counts as a period day (Light). Resolved from the global Flow category;
 * uses plaintext DTO fields (slug/order), so no decryption is needed. Returns
 * `null` if Flow isn't seeded - onset then falls back to the earliest dated day.
 */
async function defaultFlowLevelId(): Promise<string | null> {
  const flow = (await categoriesApi.list()).find((c) => c.slug === FLOW_SLUG);
  if (!flow) return null;
  const levels = (await categoryLevelsApi.list())
    .filter((l) => l.categoryId === flow.id && (l.order ?? 0) >= FLOW_PERIOD_MIN_ORDER)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return levels[0]?.id ?? null;
}

/**
 * Start a new cycle anchored at a period onset: create the cycle and its first
 * day on that date, then mark the day with a default Flow factor (Light) so it
 * counts as a period day - onset now derives from logged Flow, not a day type.
 * Used at onboarding, by the no-cycle fallback, and by "start a new period".
 * Cycle length derives client-side from onset-to-onset.
 */
export function useStartCycle() {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { onset: Date }) => {
      if (!dek) throw new Error('Vault is locked');
      const cycle = await cyclesApi.create();
      const enc = await encryptDayFields({ date: input.onset }, dek);
      const day = await daysApi.create({ cycleId: cycle.id, encDate: enc.encDate });
      const levelId = await defaultFlowLevelId();
      if (levelId) await factorsApi.create({ dayId: day.id, categoryLevelId: levelId });
      return { cycle, day };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', userId] });
      queryClient.invalidateQueries({ queryKey: ['days', userId] });
      queryClient.invalidateQueries({ queryKey: ['factors', userId] });
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
    mutationFn: async (input: { date: Date; cycleId: string }) => {
      if (!dek) throw new Error('Vault is locked');
      const enc = await encryptDayFields({ date: input.date }, dek);
      return daysApi.create({ cycleId: input.cycleId, encDate: enc.encDate });
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
    mutationFn: async (input: { id: string; date?: Date; notes?: string | null }) => {
      if (!dek) throw new Error('Vault is locked');
      const enc = await encryptDayFields({ date: input.date, notes: input.notes }, dek);
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
    mutationFn: async (input: { dayId: string; categoryLevelId: string; notes?: string; value?: number | null }) => {
      const encNotes = input.notes && dek ? await encryptString(input.notes, dek) : undefined;
      const encValue = input.value != null && dek ? await encryptString(String(input.value), dek) : undefined;
      return factorsApi.create({ dayId: input.dayId, categoryLevelId: input.categoryLevelId, encNotes, encValue });
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: ['day', userId, dayId] });
      // Onset/circle/calendar derive from factors (Flow), so refresh that too.
      queryClient.invalidateQueries({ queryKey: ['factors', userId] });
    },
  });
}

/** Edit an existing factor's note and/or numeric value (e.g. a BBT reading).
 * Pass a field as `undefined` to leave it untouched; `null` to clear it. */
export function useUpdateFactor(dayId: string) {
  const dek = useDek();
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { id: string; notes?: string | null; value?: number | null }) => {
      const body: FactorWritePayload = {};
      if (input.notes !== undefined) body.encNotes = input.notes && dek ? await encryptString(input.notes, dek) : null;
      if (input.value !== undefined) {
        body.encValue = input.value != null && dek ? await encryptString(String(input.value), dek) : null;
      }
      return factorsApi.update(input.id, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day', userId, dayId] });
      queryClient.invalidateQueries({ queryKey: ['factors', userId] });
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
      queryClient.invalidateQueries({ queryKey: ['factors', userId] });
    },
  });
}
