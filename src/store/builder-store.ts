import { create } from 'zustand'
import type { BuilderState, TableSource, Condition, ResultFormula } from '@/types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface BuilderStore {
  formulaId: string | null
  name: string
  state: BuilderState
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  isDirty: boolean

  // Meta
  setFormulaId: (id: string) => void
  setName: (name: string) => void
  /** Bulk-replace state from DB — does NOT mark dirty */
  setState: (state: BuilderState) => void
  setSaveStatus: (status: SaveStatus) => void
  setLastSavedAt: (date: Date) => void
  markClean: () => void

  // Tables
  addTable: (table: TableSource) => void
  removeTable: (tableId: string) => void
  updateTable: (tableId: string, updates: Partial<Omit<TableSource, 'id'>>) => void

  // Conditions
  addCondition: (condition: Condition) => void
  removeCondition: (conditionId: string) => void
  updateCondition: (conditionId: string, updates: Partial<Omit<Condition, 'id'>>) => void

  // Results
  addResult: (result: ResultFormula) => void
  removeResult: (resultId: string) => void
  updateResult: (resultId: string, updates: Partial<Omit<ResultFormula, 'id'>>) => void
}

const EMPTY_STATE: BuilderState = { tables: [], conditions: [], results: [] }

export const useBuilderStore = create<BuilderStore>()((set) => ({
  formulaId: null,
  name: 'Untitled',
  state: EMPTY_STATE,
  saveStatus: 'idle',
  lastSavedAt: null,
  isDirty: false,

  setFormulaId: (id) => set({ formulaId: id }),
  setName: (name) => set({ name, isDirty: true }),
  setState: (state) => set({ state, isDirty: false }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  markClean: () => set({ isDirty: false }),

  addTable: (table) =>
    set((s) => ({ state: { ...s.state, tables: [...s.state.tables, table] }, isDirty: true })),
  removeTable: (tableId) =>
    set((s) => ({
      state: { ...s.state, tables: s.state.tables.filter((t) => t.id !== tableId) },
      isDirty: true,
    })),
  updateTable: (tableId, updates) =>
    set((s) => ({
      state: {
        ...s.state,
        tables: s.state.tables.map((t) => (t.id === tableId ? { ...t, ...updates } : t)),
      },
      isDirty: true,
    })),

  addCondition: (condition) =>
    set((s) => ({
      state: { ...s.state, conditions: [...s.state.conditions, condition] },
      isDirty: true,
    })),
  removeCondition: (conditionId) =>
    set((s) => ({
      state: {
        ...s.state,
        conditions: s.state.conditions.filter((c) => c.id !== conditionId),
      },
      isDirty: true,
    })),
  updateCondition: (conditionId, updates) =>
    set((s) => ({
      state: {
        ...s.state,
        conditions: s.state.conditions.map((c) =>
          c.id === conditionId ? { ...c, ...updates } : c,
        ),
      },
      isDirty: true,
    })),

  addResult: (result) =>
    set((s) => ({
      state: { ...s.state, results: [...s.state.results, result] },
      isDirty: true,
    })),
  removeResult: (resultId) =>
    set((s) => ({
      state: { ...s.state, results: s.state.results.filter((r) => r.id !== resultId) },
      isDirty: true,
    })),
  updateResult: (resultId, updates) =>
    set((s) => ({
      state: {
        ...s.state,
        results: s.state.results.map((r) => (r.id === resultId ? { ...r, ...updates } : r)),
      },
      isDirty: true,
    })),
}))
