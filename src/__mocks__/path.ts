import { vi } from 'vitest';

// Mock path module for testing
export const join = vi.fn((...paths: string[]) => paths.join('/'));
export const resolve = vi.fn((...paths: string[]) => paths.join('/'));
export const dirname = vi.fn((path: string) => path.split('/').slice(0, -1).join('/'));
export const basename = vi.fn((path: string) => path.split('/').pop() || '');
export const extname = vi.fn((path: string) => {
    const name = path.split('/').pop() || '';
    const dotIndex = name.lastIndexOf('.');
    return dotIndex > 0 ? name.substring(dotIndex) : '';
});
export const relative = vi.fn((from: string, to: string) => to);
export const isAbsolute = vi.fn((path: string) => path.startsWith('/'));
export const normalize = vi.fn((path: string) => path);
export const parse = vi.fn((path: string) => ({
    root: '/',
    dir: dirname(path),
    base: basename(path),
    ext: extname(path),
    name: basename(path).replace(extname(path), '')
}));

export const sep = '/';
export const delimiter = ':';

// CommonJS compatibility
module.exports = {
    join,
    resolve,
    dirname,
    basename,
    extname,
    relative,
    isAbsolute,
    normalize,
    parse,
    sep,
    delimiter
};

// ES Module export
export default {
    join,
    resolve,
    dirname,
    basename,
    extname,
    relative,
    isAbsolute,
    normalize,
    parse,
    sep,
    delimiter
};