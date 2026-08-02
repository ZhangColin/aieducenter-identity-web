// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useClientInfo } from './use-client-info'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useClientInfo', () => {
  it('resolves the clientName on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ clientId: 'demo', clientName: 'Demo 应用' })),
    )

    const { result } = renderHook(() => useClientInfo('demo'))

    await waitFor(() => {
      expect(result.current.clientName).toBe('Demo 应用')
    })
    expect(result.current.invalidLink).toBe(false)
  })

  it('flags invalidLink when client_id is invalid (400)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { error: 'unauthorized_client', error_description: 'client_id 无效或未注册' },
          { status: 400 },
        ),
      ),
    )

    const { result } = renderHook(() => useClientInfo('ghost'))

    await waitFor(() => {
      expect(result.current.invalidLink).toBe(true)
    })
    expect(result.current.clientName).toBeUndefined()
  })

  it('degrades silently on other failures (network / 5xx) — login not blocked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const { result } = renderHook(() => useClientInfo('demo'))

    // 给 effect 一个 settle 的机会：不应 flag invalidLink，也不应有 clientName
    await waitFor(() => {
      expect(result.current.invalidLink).toBe(false)
    })
    expect(result.current.clientName).toBeUndefined()
  })
})
