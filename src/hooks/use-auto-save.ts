'use client'

import { useEffect, useRef } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { trpc } from '@/lib/trpc/client'

const DEBOUNCE_MS = 500

/**
 * Watches isDirty+state; debounces 500ms then persists via tRPC upsert.
 * Pass enabled=false while hydrating from DB to prevent saving stale empty state.
 *
 * Race-condition design:
 * - upsert.isPending is in deps: when mutation completes (false→true→false), the effect
 *   re-runs and catches any dirty state accumulated during the in-flight request.
 * - markClean() fires BEFORE mutate() so new user actions during in-flight correctly re-dirty.
 * - mutateRef pins the latest mutate fn to avoid stale closure inside setTimeout.
 */
export function useAutoSave(enabled: boolean) {
  const {
    formulaId,
    name,
    state,
    isDirty,
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
  const mutateRef = useRef(upsert.mutate) // M-3: always-current mutate fn
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { formulaIdRef.current = formulaId }, [formulaId])
  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { mutateRef.current = upsert.mutate }, [upsert.mutate])

  useEffect(() => {
    if (!enabled || !isDirty) return

    // H-1 fix: don't schedule while a request is in-flight.
    // upsert.isPending is in deps, so when it flips false the effect re-runs
    // and picks up any dirty state that accumulated during the request.
    if (upsert.isPending) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      markClean()         // mark clean BEFORE mutating; new actions re-dirty correctly
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentional: markClean/setSaveStatus are stable Zustand setters (omitted to prevent loop).
    // upsert.isPending intentionally included — re-runs after in-flight completes (H-1 fix).
  }, [state, isDirty, enabled, name, upsert.isPending])
}
