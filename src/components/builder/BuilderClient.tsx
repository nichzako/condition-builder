'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useBuilderStore } from '@/store/builder-store'
import { trpc } from '@/lib/trpc/client'
import { useAutoSave } from '@/hooks/use-auto-save'
import { BuilderShell } from '@/components/builder/BuilderShell'

export function BuilderClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')

  const { setState, setFormulaId, setName, formulaId } = useBuilderStore()
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(!id)
  const hydratedRef = useRef(false)

  const { data, isLoading } = trpc.formula.get.useQuery(
    { id: id! },
    { enabled: !!id, refetchOnWindowFocus: false, retry: false },
  )

  useEffect(() => {
    if (data && !hydratedRef.current) {
      hydratedRef.current = true
      setState(data.state)
      setFormulaId(data.id)
      setName(data.name)
      setAutoSaveEnabled(true)
    }
  }, [data, setState, setFormulaId, setName])

  // Once a new formula is created, push its id into the URL
  useEffect(() => {
    if (formulaId && !id) {
      router.replace(`/builder?id=${formulaId}`, { scroll: false })
    }
  }, [formulaId, id, router])

  useAutoSave(autoSaveEnabled)

  if (id && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">
        Loading formula...
      </div>
    )
  }

  return <BuilderShell />
}
