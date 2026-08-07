'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseCountdown {
  /** 剩余秒数；0 表示未运行。 */
  remaining: number
  /** 是否正在倒计时。 */
  isRunning: boolean
  /** 从指定秒数开始倒计时；会替换进行中的倒计时。 */
  start: (seconds: number) => void
  /** 立即停止并把剩余清零。 */
  reset: () => void
}

/**
 * 倒计时原语：每秒递减，到 0 自停并清理定时器；卸载时清理（不泄漏、不更新已卸载组件）。
 * 纯定时器，不识 fetch/业务；由 useSendCode 组合用于发码冷却。
 */
export function useCountdown(): UseCountdown {
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clear()
    setRemaining(0)
  }, [clear])

  const start = useCallback(
    (seconds: number) => {
      clear()
      setRemaining(seconds)
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clear()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [clear],
  )

  useEffect(() => clear, [clear])

  return { remaining, isRunning: remaining > 0, start, reset }
}
