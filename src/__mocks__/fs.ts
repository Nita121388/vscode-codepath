import { vi } from 'vitest';

// Mock fs module for testing
export const promises = {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn()
};

export const readFileSync = vi.fn();
export const writeFileSync = vi.fn();
export const existsSync = vi.fn();
export const mkdirSync = vi.fn();
export const statSync = vi.fn();

// CommonJS compatibility
module.exports = {
    promises,
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    statSync
};

// ES Module export
export default {
    promises,
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    statSync
};