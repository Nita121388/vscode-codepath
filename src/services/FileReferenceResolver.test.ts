import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileReferenceResolver } from './FileReferenceResolver';

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [],
        fs: {
            stat: vi.fn()
        },
        findFiles: vi.fn(() => Promise.resolve([]))
    },
    Uri: {
        file: (fsPath: string) => ({ fsPath, scheme: 'file' })
    },
    FileType: {
        File: 1,
        Directory: 2
    }
}));

describe('FileReferenceResolver', () => {
    it('parses hash line references', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('ReagentGridView.cs#L794')).toEqual({
            rawText: 'ReagentGridView.cs#L794',
            filePath: 'ReagentGridView.cs',
            lineNumber: 794,
            columnNumber: undefined,
            endLineNumber: undefined
        });
    });

    it('parses colon references with columns', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('src/views/ReagentGridView.cs:48:7')).toEqual({
            rawText: 'src/views/ReagentGridView.cs:48:7',
            filePath: 'src/views/ReagentGridView.cs',
            lineNumber: 48,
            columnNumber: 7,
            endLineNumber: undefined
        });
    });

    it('parses Visual Studio style references', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('C:\\repo\\src\\ReagentGridView.cs(128,9)')).toEqual({
            rawText: 'C:\\repo\\src\\ReagentGridView.cs(128,9)',
            filePath: 'C:\\repo\\src\\ReagentGridView.cs',
            lineNumber: 128,
            columnNumber: 9,
            endLineNumber: undefined
        });
    });

    it('parses line keyword references in parentheses', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('TestResult.cs (line 213)')).toEqual({
            rawText: 'TestResult.cs (line 213)',
            filePath: 'TestResult.cs',
            lineNumber: 213,
            columnNumber: undefined,
            endLineNumber: undefined
        });
    });

    it('parses line keyword references with column in parentheses', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('TestResult.cs (Line 213, col 9)')).toEqual({
            rawText: 'TestResult.cs (Line 213, col 9)',
            filePath: 'TestResult.cs',
            lineNumber: 213,
            columnNumber: 9,
            endLineNumber: undefined
        });
    });

    it('parses fallback references from file plus line data in one sentence', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('定位结果: 文件=TestResult.cs, line=213, col=9')).toEqual({
            rawText: '定位结果: 文件=TestResult.cs, line=213, col=9',
            filePath: 'TestResult.cs',
            lineNumber: 213,
            columnNumber: 9,
            endLineNumber: undefined
        });
    });

    it('parses fallback references when file and line data are split across lines', () => {
        const resolver = new FileReferenceResolver();

        expect(
            resolver.parseReference('分析结果:\n结果文件: TestResult.cs\n数据: 行号 213')
        ).toEqual({
            rawText: 'TestResult.cs line 213',
            filePath: 'TestResult.cs',
            lineNumber: 213,
            columnNumber: undefined,
            endLineNumber: undefined
        });
    });

    it('parses stack trace references inside parentheses', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('at renderCell (src/views/ReagentGridView.cs:48:7)')).toEqual({
            rawText: 'src/views/ReagentGridView.cs:48:7',
            filePath: 'src/views/ReagentGridView.cs',
            lineNumber: 48,
            columnNumber: 7,
            endLineNumber: undefined
        });
    });

    it('parses Python traceback references', () => {
        const resolver = new FileReferenceResolver();

        expect(resolver.parseReference('File "src/app/main.py", line 42, in run')).toEqual({
            rawText: 'File "src/app/main.py", line 42',
            filePath: 'src/app/main.py',
            lineNumber: 42,
            columnNumber: undefined,
            endLineNumber: undefined
        });
    });

    it('parses markdown GitHub references', () => {
        const resolver = new FileReferenceResolver();

        expect(
            resolver.parseReference('[open](https://github.com/org/repo/blob/main/src/views/ReagentGridView.cs#L48-L50)')
        ).toEqual({
            rawText: 'https://github.com/org/repo/blob/main/src/views/ReagentGridView.cs#L48-L50',
            filePath: 'src/views/ReagentGridView.cs',
            lineNumber: 48,
            columnNumber: undefined,
            endLineNumber: 50
        });
    });

    it('prefers direct relative matches inside the workspace', async () => {
        const makeUri = (fsPath: string) => ({ fsPath, scheme: 'file' } as vscode.Uri);
        const resolver = new FileReferenceResolver({
            workspaceFoldersProvider: () => [{ uri: makeUri('C:/repo') } as vscode.WorkspaceFolder],
            uriFactory: makeUri,
            stat: async (uri: vscode.Uri) => {
                if (uri.fsPath === 'C:/repo/src/ReagentGridView.cs' || uri.fsPath === 'C:\\repo\\src\\ReagentGridView.cs') {
                    return { type: vscode.FileType.File } as vscode.FileStat;
                }

                throw new Error('not found');
            },
            findFiles: async () => []
        });

        const resolved = await resolver.resolveReference('src/ReagentGridView.cs(21,3)');

        expect(resolved.candidates).toHaveLength(1);
        expect(resolved.candidates[0].fsPath.replace(/\\/g, '/')).toBe('C:/repo/src/ReagentGridView.cs');
        expect(resolved.reference.columnNumber).toBe(3);
    });

    it('filters workspace matches by path suffix', async () => {
        const makeUri = (fsPath: string) => ({ fsPath, scheme: 'file' } as vscode.Uri);
        const resolver = new FileReferenceResolver({
            workspaceFoldersProvider: () => [{ uri: makeUri('C:/repo') } as vscode.WorkspaceFolder],
            uriFactory: makeUri,
            stat: async () => {
                throw new Error('not found');
            },
            findFiles: async () => [
                makeUri('C:/repo/legacy/ReagentGridView.cs'),
                makeUri('C:/repo/src/views/ReagentGridView.cs')
            ]
        });

        const resolved = await resolver.resolveReference('https://github.com/org/repo/blob/main/src/views/ReagentGridView.cs#L21');

        expect(resolved.candidates).toHaveLength(1);
        expect(resolved.candidates[0].fsPath).toBe('C:/repo/src/views/ReagentGridView.cs');
    });

    it('falls back to another resolvable reference when the top parsed reference is missing', async () => {
        const makeUri = (fsPath: string) => ({ fsPath, scheme: 'file' } as vscode.Uri);
        const resolver = new FileReferenceResolver({
            workspaceFoldersProvider: () => [{ uri: makeUri('C:/repo') } as vscode.WorkspaceFolder],
            uriFactory: makeUri,
            stat: async (uri: vscode.Uri) => {
                if (uri.fsPath === 'C:/repo/src/services/FileReferenceResolver.js') {
                    return { type: vscode.FileType.File } as vscode.FileStat;
                }

                throw new Error('not found');
            },
            findFiles: async () => [makeUri('C:/repo/src/services/FileReferenceResolver.js')]
        });

        const resolved = await resolver.resolveReference(
            '未找到文件引用：TestResult.cs#L213\n' +
            'at FileReferenceResolver.resolveReference (src/services/FileReferenceResolver.js:86:19)'
        );

        expect(resolved.reference.filePath).toBe('src/services/FileReferenceResolver.js');
        expect(resolved.reference.lineNumber).toBe(86);
        expect(resolved.reference.columnNumber).toBe(19);
        expect(resolved.candidates).toHaveLength(1);
        expect(resolved.candidates[0].fsPath).toBe('C:/repo/src/services/FileReferenceResolver.js');
    });
});
