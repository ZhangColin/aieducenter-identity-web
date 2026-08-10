// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useClientName } from './use-client-name'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useClientName', () => {
  it('resolves the clientName on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ clientId: 'demo', clientName: 'Demo 应用' })),
    )

    const { result } = renderHook(() => useClientName('demo'))

    await waitFor(() => {
      expect(result.current).toBe('Demo 应用')
    })
  })

  it('does not fetch and stays undefined when clientId is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useClientName(undefined))

    expect(result.current).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('degrades to undefined on client-info 400 — no invalid-link branch (unlike useClientInfo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { error: 'unauthorized_client', error_description: 'client_id 无效或未注册' },
          { status: 400 },
        ),
      ),
    )

    const { result } = renderHook(() => useClientName('ghost'))

    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
  })

  it('degrades to undefined on network / 5xx failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const { result } = renderHook(() => useClientName('demo'))

    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
  })
})
