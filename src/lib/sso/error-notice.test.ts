import { describe, expect, it } from 'vitest'

import { errorNotice } from './error-notice'

describe('errorNotice', () => {
  it('guides back to the resolved app when clientName is known', () => {
    expect(errorNotice('智研笔记')).toEqual({
      title: '出错了',
      message: '请回到「智研笔记」重新发起登录。',
    })
  })

  it('falls back to a generic notice when clientName is missing', () => {
    expect(errorNotice(undefined)).toEqual({
      title: '应用信息异常',
      message: '请重新从应用进入登录。',
    })
  })

  it('falls back to generic when clientName resolved to empty (degrade, never partial)', () => {
    expect(errorNotice('')).toEqual({
      title: '应用信息异常',
      message: '请重新从应用进入登录。',
    })
  })
})
