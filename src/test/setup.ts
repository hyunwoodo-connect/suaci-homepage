/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// jsdom localStorage 초기화 (mock store 테스트 격리)
beforeEach(() => {
  localStorage.clear()
})
