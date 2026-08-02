import { describe, expect, it } from 'vitest'

import { parseContact } from './contact'

describe('parseContact', () => {
  it('classifies a valid email', () => {
    expect(parseContact('demo@aieducenter.com')).toEqual({ type: 'email', value: 'demo@aieducenter.com' })
    expect(parseContact('a@b.co')).toEqual({ type: 'email', value: 'a@b.co' })
    expect(parseContact('user.name+tag@sub.domain.org')).toEqual({
      type: 'email',
      value: 'user.name+tag@sub.domain.org',
    })
  })

  it('classifies a valid mainland phone number', () => {
    expect(parseContact('13800138000')).toEqual({ type: 'phone', value: '13800138000' })
    expect(parseContact('19912345678')).toEqual({ type: 'phone', value: '19912345678' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseContact('  demo@aieducenter.com  ')).toEqual({ type: 'email', value: 'demo@aieducenter.com' })
  })

  it('returns null for blank input', () => {
    expect(parseContact('')).toBeNull()
    expect(parseContact('   ')).toBeNull()
  })

  it('returns null for malformed emails', () => {
    expect(parseContact('not-an-email')).toBeNull()
    expect(parseContact('demo@')).toBeNull()
    expect(parseContact('@domain.com')).toBeNull()
    expect(parseContact('demo@domain')).toBeNull()
  })

  it('returns null for malformed phones', () => {
    expect(parseContact('1380013800')).toBeNull() // 10 位
    expect(parseContact('138001380000')).toBeNull() // 12 位
    expect(parseContact('12345678901')).toBeNull() // 非 1[3-9] 号段
    expect(parseContact('1380013800a')).toBeNull()
  })
})
