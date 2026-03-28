import { vi } from 'vitest'

/**
 * Mock for @tauri-apps/api/core
 * This intercepts all `invoke` calls from the app so tests
 * don't try to reach the real Tauri backend.
 */
export const invoke = vi.fn()

export default { invoke }
