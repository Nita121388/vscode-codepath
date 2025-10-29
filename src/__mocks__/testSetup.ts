// Test setup file for vitest
// This file ensures consistent global behavior

import { vi } from 'vitest';

// Ensure consistent global behavior
global.console = {
    ...console,
    // Suppress noisy logs during tests
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};