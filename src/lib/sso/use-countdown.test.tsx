// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCountdown } from './use-countdown'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountdown', () => {
  it('starts at the given seconds and ticks down once per second', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(60))
    expect(result.current.remaining).toBe(60)
    expect(result.current.isRunning).toBe(true)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(59)
  })

  it('stops at 0 and clears the timer (no negative / no further ticks)', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(2))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(1)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(0)
    expect(result.current.isRunning).toBe(false)

    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.remaining).toBe(0)
  })

  it('reset() clears the countdown mid-run', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(60))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remaining).toBe(59)

    act(() => result.current.reset())
    expect(result.current.remaining).toBe(0)
    expect(result.current.isRunning).toBe(false)

    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.remaining).toBe(0)
  })

  it('can be restarted after finishing or resetting', () => {
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(10))
    act(() => result.current.reset())
    act(() => result.current.start(30))

    expect(result.current.remaining).toBe(30)
    expect(result.current.isRunning).toBe(true)
  })

  it('clears the timer on unmount (no state update after unmount)', () => {
    const { result, unmount } = renderHook(() => useCountdown())

    act(() => result.current.start(60))
    unmount()

    // 推进时间不应触发任何已卸载组件的状态更新（不抛 React 警告）
    expect(() => act(() => vi.advanceTimersByTime(10000))).not.toThrow()
  })
})
