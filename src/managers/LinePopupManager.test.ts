import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { LinePopupManager } from './LinePopupManager';

vi.mock('vscode', () => import('../__mocks__/vscode'));

const createDocumentFromLines = (lines: string[]): vscode.TextDocument => {
    const text = lines.join('\n');
    const toOffset = (position: vscode.Position): number => {
        let offset = 0;
        for (let lineIndex = 0; lineIndex < position.line; lineIndex++) {
            offset += lines[lineIndex].length + 1;
        }
        return offset + position.character;
    };

    return {
        lineAt: (index: number) => ({
            text: lines[index],
            range: new vscode.Range(
                new vscode.Position(index, 0),
                new vscode.Position(index, lines[index].length)
            )
        }),
        uri: vscode.Uri.file(`/test/document-${Math.random().toString(16).slice(2)}.ts`),
        version: 1,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return text;
            }
            const start = toOffset(range.start);
            const end = toOffset(range.end);
            return text.slice(start, end);
        },
        fileName: '/test/file.ts'
    } as unknown as vscode.TextDocument;
};

describe('LinePopupManager', () => {
    let manager: LinePopupManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        vi.clearAllMocks();
        (vscode.window.visibleTextEditors as any).length = 0;
        (vscode.window as any).activeTextEditor = undefined;
        mockContext = {
            extensionUri: { fsPath: process.cwd(), scheme: 'file' },
            subscriptions: []
        } as unknown as vscode.ExtensionContext;
        manager = new LinePopupManager(mockContext);
    });

    afterEach(() => {
        manager.dispose();
    });

    describe('normalizeSelection', () => {
        it('returns null when selection is empty', () => {
            const document = createDocumentFromLines(['const sample = 1;']);
            const position = new vscode.Position(0, 2);
            const selection = new vscode.Selection(position, position);

            const normalized = LinePopupManager.normalizeSelection(document, selection);
            expect(normalized).toBeNull();
        });

        it('keeps partial single-line selections as-is', () => {
            const document = createDocumentFromLines(['const foo = 1;', 'const bar = 2;']);
            const selection = new vscode.Selection(
                new vscode.Position(0, 2),
                new vscode.Position(0, 5)
            );

            const normalized = LinePopupManager.normalizeSelection(document, selection);
            expect(normalized).not.toBeNull();
            expect(normalized?.start.character).toBe(2);
            expect(normalized?.end.character).toBe(5);
        });

        it('preserves multi-line selections', () => {
            const document = createDocumentFromLines([
                'function demo() {',
                '  return call();',
                '}'
            ]);

            const selection = new vscode.Selection(
                new vscode.Position(0, 4),
                new vscode.Position(2, 1)
            );

            const normalized = LinePopupManager.normalizeSelection(document, selection);
            expect(normalized).not.toBeNull();
            expect(normalized?.start.line).toBe(0);
            expect(normalized?.end.line).toBe(2);
        });
    });

    it('opens the popup when a valid selection exists in the active editor', async () => {
        const document = createDocumentFromLines(['const title = "demo";', 'const body = "content";']);
        const selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(1, 0)
        );

        const editor = {
            document,
            selection,
            selections: [selection],
            edit: vi.fn(() => Promise.resolve(true)),
            setDecorations: vi.fn()
        } as unknown as vscode.TextEditor;

        (vscode.window.visibleTextEditors as any).push(editor);
        (vscode.window as any).activeTextEditor = editor;

        const range = LinePopupManager.normalizeSelection(document, selection);
        expect(range).not.toBeNull();

        (manager as any).updateSelectionState({
            uri: document.uri,
            range,
            version: document.version
        }, editor);

        await (manager as any).handleShowPopupCommand();
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        const createdPanel = (vscode.window.createWebviewPanel as unknown as Mock).mock.results[0].value;
        const postMessageMock = createdPanel.webview.postMessage as Mock;
        const sentPayload = postMessageMock.mock.calls[0][0];
        expect(sentPayload).toMatchObject({
            type: 'update',
            payload: expect.objectContaining({ startLine: 1 })
        });
    });
});
