'use client'

import { useEffect, useRef } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { trpc } from '@/lib/trpc/client'

const DEBOUNCE_MS = 500
const SAVED_DISMISS_MS = 2000

/**
 * Watches isDirty+state; debounces 500ms then persists via tRPC upsert.
 * Pass enabled=false while hydrating from DB to prevent saving stale empty state.
 *
 * Race-condition design:
 * - upsert.isPending is in deps: when mutation completes (false→true→false), the effect
 *   re-runs and catches any dirty state accumulated during the in-flight request.
 * - markClean() fires BEFORE mutate() so new user actions during in-flight correctly re-dirty.
 * - mutateRef pins the latest mutate fn to avoid stale closure inside setTimeout.
 * - 'saved' → 'idle' dismiss lives here (not in SaveIndicator) so a single owner controls
 *   the status lifecycle and multiple mounts of the indicator cannot race.
 */
export function useAutoSave(enabled: boolean) {
  const {
    formulaId,
    name,
    state,
    isDirty,
    saveStatus,
    setFormulaId,
    setSaveStatus,
    setLastSavedAt,
    markClean,
  } = useBuilderStore()

  const upsert = trpc.formula.upsert.useMutation({
    onSuccess: (data) => {
      setFormulaId(data.id)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
    },
    onError: () => setSaveStatus('error'),
  })

  const formulaIdRef = useRef(formulaId)
  const nameRef = useRef(name)
  const stateRef = useRef(state)
  const mutateRef = useRef(upsert.mutate)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { formulaIdRef.current = formulaId }, [formulaId])
  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { mutateRef.current = upsert.mutate }, [upsert.mutate])

  // Auto-dismiss 'saved' status — owned here so SaveIndicator stays purely presentational
  useEffect(() => {
    if (saveStatus !== 'saved') return
    dismissRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISMISS_MS)
    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current)
    }
  }, [saveStatus, setSaveStatus])

  useEffect(() => {
    if (!enabled || !isDirty) return

    // Don't schedule while a request is in-flight; re-runs when isPending flips false
    if (upsert.isPending) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      markClean()
      setSaveStatus('saving')
      mutateRef.current({
        ...(formulaIdRef.current ? { id: formulaIdRef.current } : {}),
        name: nameRef.current,
        state: stateRef.current,
      })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // markClean/setSaveStatus are stable Zustand setters — safe to omit from deps.
    // upsert.isPending intentionally included — re-runs after in-flight completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isDirty, enabled, name, upsert.isPending])
}
