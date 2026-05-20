'use client'

import { useEffect, useRef } from 'react'
import { useBuilderStore } from '@/store/builder-store'
import { trpc } from '@/lib/trpc/client'

const DEBOUNCE_MS = 500

/**
 * Watches isDirty+state; debounces 500ms then persists via tRPC upsert.
 * Pass enabled=false while hydrating from DB to prevent saving stale empty state.
 *
 * markClean() is called BEFORE mutate() so that any new user action during
 * the in-flight request correctly re-marks isDirty and triggers a follow-up save.
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

  // Refs avoid stale closures inside setTimeout
  const formulaIdRef = useRef(formulaId)
  const nameRef = useRef(name)
  const stateRef = useRef(state)
  const isPendingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { formulaIdRef.current = formulaId }, [formulaId])
  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { isPendingRef.current = upsert.isPending }, [upsert.isPending])

  useEffect(() => {
    if (!enabled || !isDirty) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      // Guard: skip if a mutation is already in-flight (avoids concurrent saves)
      if (isPendingRef.current) return

      // Mark clean BEFORE mutating so any new user action during the request
      // correctly re-sets isDirty and schedules a follow-up save.
      markClean()
      setSaveStatus('saving')
      upsert.mutate({
        ...(formulaIdRef.current ? { id: formulaIdRef.current } : {}),
        name: nameRef.current,
        state: stateRef.current,
      })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isDirty, enabled, name])
}
