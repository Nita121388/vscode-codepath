import * as vscode from 'vscode';
import { executeCommandSafely } from '../utils/vscodeHelpers';
import { FeedbackManager } from './FeedbackManager';

interface SelectionSnapshot {
    uri: vscode.Uri;
    range: vscode.Range;
    version: number;
}

interface EditSession extends SelectionSnapshot {
    rangeLabel: string;
    fileLabel: string;
}

interface PanelPayload {
    text: string;
    fileLabel: string;
    rangeLabel: string;
    startLine: number;
}

/**
 * 行内容弹窗编辑管理器：
 * - 监听编辑器选区，在左侧 gutter 显示 🪧 图标以及 Code Action 灯泡
 * - 通过命令打开 Webview 弹窗，按“行”为单位渲染，每一行都有独立行号与编辑区域
 */
export class LinePopupManager implements vscode.Disposable, vscode.CodeActionProvider {
    private disposables: vscode.Disposable[] = [];
    private currentSelection: SelectionSnapshot | null = null;
    private panel: vscode.WebviewPanel | null = null;
    private editSession: EditSession | null = null;
    private readonly selectionDecoration: vscode.TextEditorDecorationType;
    private readonly feedbackManager: FeedbackManager;

    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    constructor(private readonly context: vscode.ExtensionContext) {
        // 不再在 gutter 中显示图标，仅保留逻辑上的选区标记能力
        this.selectionDecoration = vscode.window.createTextEditorDecorationType({});
        this.disposables.push(this.selectionDecoration);

        this.feedbackManager = new FeedbackManager();

        this.disposables.push(
            vscode.commands.registerCommand('codepath.showSelectionPopup', this.handleShowPopupCommand.bind(this)),
            vscode.commands.registerCommand('codepath.editSelectionInPopup', this.handleShowPopupCommand.bind(this)),
            vscode.window.onDidChangeTextEditorSelection(this.handleSelectionChange.bind(this)),
            vscode.window.onDidChangeActiveTextEditor(this.handleActiveEditorChange.bind(this)),
            vscode.window.onDidChangeVisibleTextEditors(() => this.updateDecorations()),
            vscode.languages.registerCodeActionsProvider(
                [{ scheme: 'file' }, { scheme: 'untitled' }],
                this,
                { providedCodeActionKinds: LinePopupManager.providedCodeActionKinds }
            )
        );

        this.captureInitialSelection();
    }

    /**
     * 统一封装调试日志入口，输出到 CodePath Debug 输出面板和控制台
     */
    private logDebug(operation: string, message: string, data?: any): void {
        this.feedbackManager.log('debug', 'LinePopupManager', operation, message, data);
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }

        this.clearDecorations();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.currentSelection = null;
        this.editSession = null;
    }

    private captureInitialSelection(): void {
        const editor = vscode.window.activeTextEditor;
        const snapshot = this.createSnapshotFromEditor(editor ?? undefined);
        this.updateSelectionState(snapshot, editor ?? undefined);
    }

    private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
        const snapshot = this.createSnapshotFromEditor(editor ?? undefined);
        this.updateSelectionState(snapshot, editor ?? undefined);
    }

    private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
        if (!event.selections.length) {
            this.updateSelectionState(null);
            return;
        }
        const snapshot = this.createSnapshot(event.textEditor.document, event.selections[0]);
        this.updateSelectionState(snapshot, event.textEditor);
    }

    private createSnapshotFromEditor(editor?: vscode.TextEditor): SelectionSnapshot | null {
        if (!editor || !editor.selection || editor.selections.length === 0) {
            return null;
        }
        return this.createSnapshot(editor.document, editor.selection);
    }

    private createSnapshot(document: vscode.TextDocument, selection: vscode.Selection): SelectionSnapshot | null {
        const normalized = LinePopupManager.normalizeSelection(document, selection);
        if (!normalized) {
            return null;
        }
        return {
            uri: document.uri,
            range: normalized,
            version: document.version
        };
    }

    private updateSelectionState(snapshot: SelectionSnapshot | null, sourceEditor?: vscode.TextEditor): void {
        this.currentSelection = snapshot;
        this.updateContext(!!snapshot);

        if (!snapshot) {
            this.clearDecorations();
            return;
        }

        this.updateDecorations(sourceEditor);
    }

    private updateDecorations(sourceEditor?: vscode.TextEditor): void {
        if (!this.currentSelection) {
            this.clearDecorations();
            return;
        }
        const targetUri = this.currentSelection.uri.toString();
        const indicatorRange = new vscode.Range(
            this.currentSelection.range.start.line,
            0,
            this.currentSelection.range.start.line,
            0
        );
        const editors = vscode.window.visibleTextEditors;
        let hasMatch = false;

        for (const editor of editors) {
            if (editor.document.uri.toString() === targetUri) {
                editor.setDecorations(this.selectionDecoration, [indicatorRange]);
                hasMatch = true;
            } else {
                editor.setDecorations(this.selectionDecoration, []);
            }
        }

        if (!hasMatch && sourceEditor && sourceEditor.document.uri.toString() === targetUri) {
            sourceEditor.setDecorations(this.selectionDecoration, [indicatorRange]);
        }
    }

    private clearDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.selectionDecoration, []);
        }
    }

    private async handleShowPopupCommand(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        console.debug('[LinePopupManager] showSelectionPopup triggered', {
            hasSelection: !!this.currentSelection
        });
        this.logDebug('handleShowPopupCommand', 'showSelectionPopup triggered', {
            hasSelection: !!this.currentSelection,
            hasActiveEditor: !!activeEditor
        });

        const snapshot = this.currentSelection ?? this.createSnapshotFromEditor(activeEditor ?? undefined);

        if (!snapshot) {
            vscode.window.showInformationMessage('请先选中至少一个字符，再使用行内容弹窗。');
            return;
        }

        const editor = await this.resolveEditor(snapshot);
        if (!editor) {
            vscode.window.showWarningMessage('无法定位所选文件，请确认它仍存在。');
            return;
        }

        const selectionMatches =
            this.currentSelection &&
            this.currentSelection.uri.toString() === snapshot.uri.toString() &&
            this.currentSelection.range.isEqual(snapshot.range);

        if (!selectionMatches) {
            this.logDebug('handleShowPopupCommand', 'selection snapshot does not match currentSelection, updating state', {
                previousUri: this.currentSelection?.uri.toString(),
                newUri: snapshot.uri.toString()
            });
            this.updateSelectionState(snapshot, editor);
        }

        if (editor.document.version !== snapshot.version) {
            this.logDebug('handleShowPopupCommand', 'document version changed since snapshot', {
                snapshotVersion: snapshot.version,
                currentVersion: editor.document.version
            });
            const answer = await vscode.window.showWarningMessage(
                '目标文件在选中后已经发生变更，确定继续编辑当前内容吗？',
                '继续编辑',
                '取消'
            );
            if (answer !== '继续编辑') {
                return;
            }
        }

        const session: EditSession = {
            uri: editor.document.uri,
            range: snapshot.range,
            version: editor.document.version,
            rangeLabel: this.buildRangeLabel(snapshot.range),
            fileLabel: this.getFileLabel(editor.document)
        };

        this.editSession = session;
        const selectionText = editor.document.getText(snapshot.range);
        const startLineZeroBased = session.range.start.line;

        console.debug('[LinePopupManager] preparing popup payload', {
            file: session.fileLabel,
            range: session.rangeLabel,
            length: selectionText.length,
            startLine: startLineZeroBased + 1
        });
        this.logDebug('handleShowPopupCommand', 'preparing popup payload', {
            file: session.fileLabel,
            range: session.rangeLabel,
            textLength: selectionText.length,
            startLine: startLineZeroBased + 1
        });

        await this.openPanel(session, {
            text: selectionText,
            fileLabel: session.fileLabel,
            rangeLabel: session.rangeLabel,
            startLine: startLineZeroBased + 1
        });
    }

    private async openPanel(session: EditSession, payload: PanelPayload): Promise<void> {
        if (!this.panel) {
            this.logDebug('openPanel', 'creating new webview panel', {
                fileLabel: session.fileLabel,
                rangeLabel: session.rangeLabel
            });
            this.panel = vscode.window.createWebviewPanel(
                'codepath.lineContentEditor',
                'CodePath 行内容编辑',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: false,
                    localResourceRoots: []
                }
            );

            const messageSubscription = this.panel.webview.onDidReceiveMessage(message => {
                this.logDebug('openPanel', 'received message from webview', { messageType: message?.type });
                this.handleWebviewMessage(message);
            });

            this.panel.onDidDispose(() => {
                this.logDebug('openPanel', 'panel disposed');
                messageSubscription.dispose();
                this.panel = null;
                this.editSession = null;
            });

            const html = this.getPanelHtml(this.panel.webview);
            const nonceMatch = html.match(/nonce="([^"]+)"/);
            const cspMatch = html.match(/Content-Security-Policy[^>]+>/);
            const metaTagMatch = html.match(/<meta[^>]*Content-Security-Policy[^>]*>/);
            this.logDebug('openPanel', 'setting webview HTML', {
                htmlLength: html.length,
                htmlPreview: html.substring(0, 300),
                scriptStartIndex: html.indexOf('<script'),
                hasNonce: html.includes('nonce='),
                nonceValue: nonceMatch ? nonceMatch[1] : 'NOT_FOUND',
                cspMetaTag: metaTagMatch ? metaTagMatch[0] : 'NOT_FOUND',
                scriptTag: html.substring(html.indexOf('<script'), html.indexOf('<script') + 100)
            });
            this.panel.webview.html = html;
            this.logDebug('openPanel', 'webview HTML set successfully');
        }

        this.panel.title = `CodePath 行内容编辑 (${session.fileLabel})`;
        this.panel.reveal(vscode.ViewColumn.Beside);
        this.logDebug('openPanel', 'about to post update message', {
            payload: {
                textLength: payload.text?.length ?? 0,
                fileLabel: payload.fileLabel,
                rangeLabel: payload.rangeLabel,
                startLine: payload.startLine,
                textPreview: payload.text?.substring(0, 50)
            }
        });
        const postResult = await this.panel.webview.postMessage({ type: 'update', payload });
        this.logDebug('openPanel', 'postMessage completed', {
            success: postResult,
            payloadSummary: {
                textLength: payload.text?.length ?? 0,
                fileLabel: payload.fileLabel,
                rangeLabel: payload.rangeLabel,
                startLine: payload.startLine
            }
        });
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        if (!message || typeof message !== 'object') {
            return;
        }

        if (message.type === 'save') {
            await this.saveEditedContent(typeof message.value === 'string' ? message.value : '');
            return;
        }

        if (message.type === 'cancel' && this.panel) {
            this.panel.dispose();
        }
    }

    private async saveEditedContent(newText: string): Promise<void> {
        if (!this.editSession) {
            vscode.window.showWarningMessage('没有可保存的编辑内容。');
            return;
        }

        const editor = await this.resolveEditor(this.editSession);
        if (!editor) {
            vscode.window.showErrorMessage('无法找到目标编辑器，保存失败。');
            return;
        }

        if (editor.document.version !== this.editSession.version) {
            const answer = await vscode.window.showWarningMessage(
                '目标文件内容已变更，是否仍要覆盖当前选区？',
                '覆盖保存',
                '取消'
            );
            if (answer !== '覆盖保存') {
                return;
            }
        }

        const succeeded = await editor.edit(editBuilder => {
            editBuilder.replace(this.editSession!.range, newText);
        });

        if (!succeeded) {
            vscode.window.showErrorMessage('写回文件失败，请稍后重试。');
            return;
        }

        const newEnd = this.advancePosition(this.editSession.range.start, newText);
        this.editSession.version = editor.document.version;
        this.editSession.range = new vscode.Range(this.editSession.range.start, newEnd);


        this.currentSelection = this.editSession;
        this.updateDecorations(editor);

        vscode.window.showInformationMessage('行内容已成功更新。');
        if (this.panel) {
            void this.panel.webview.postMessage({ type: 'saved' });
        }
    }

    private async resolveEditor(snapshot: SelectionSnapshot): Promise<vscode.TextEditor | null> {
        const existing = this.findEditor(snapshot.uri);
        if (existing) {
            return existing;
        }

        try {
            const document = await vscode.workspace.openTextDocument(snapshot.uri);
            return await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: true
            });
        } catch (error) {
            this.feedbackManager.log(
                'warn',
                'LinePopupManager',
                'resolveEditor',
                'Failed to open document for line popup editing',
                { uri: snapshot.uri.toString() },
                error instanceof Error ? error : new Error(String(error))
            );
            return null;
        }
    }

    private findEditor(uri: vscode.Uri): vscode.TextEditor | undefined {
        return vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri.toString());
    }

    private getPanelHtml(webview: vscode.Webview): string {
        // 使用字符串拼接而不是模板字符串，避免 VS Code webview 的解析问题
        // 注意：必须使用 + 拼接，不能使用反引号模板字符串
        const html =
            '<!DOCTYPE html>' +
            '<html lang="zh-CN">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>CodePath 行内容编辑</title>' +
            '<style>' +
            'body { margin: 0; padding: 0; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-editor-foreground, #d4d4d4); font-family: var(--vscode-font-family); height: 100vh; display: flex; flex-direction: column; }' +
            'header, footer { padding: 12px 16px; border-bottom: 1px solid var(--vscode-editorWidget-border); }' +
            'header { font-size: 12px; line-height: 1.4; }' +
            'header .range { color: var(--vscode-descriptionForeground); margin-top: 4px; }' +
            '.editor { flex: 1; display: flex; flex-direction: column; font-family: var(--vscode-editor-font-family, Consolas, monospace); font-size: var(--vscode-editor-font-size, 14px); line-height: 1.5; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); overflow: auto; }' +
            '.code-line-row { display: flex; }' +
            '.code-line-number { width: 56px; padding: 4px 8px; text-align: right; user-select: none; color: var(--vscode-editorLineNumber-foreground, #858585); background: var(--vscode-sideBar-background, #252526); border-right: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08)); }' +
            '.code-line-input { flex: 1; padding: 4px 8px; border: none; resize: none; font: inherit; line-height: inherit; background: transparent; color: inherit; white-space: pre-wrap; overflow: hidden; min-height: 1.5em; }' +
            '.code-line-input:focus { outline: none; }' +
            'footer { border-top: 1px solid var(--vscode-editorWidget-border); border-bottom: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }' +
            '.actions button { padding: 6px 16px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }' +
            '.actions button.secondary { background: transparent; border-color: var(--vscode-editorWidget-border); color: var(--vscode-editor-foreground); }' +
            '.status { font-size: 12px; color: var(--vscode-descriptionForeground); }' +
            '</style>' +
            '</head>' +
            '<body>' +
            '<header>' +
            '<div id="file-label"></div>' +
            '<div id="range-label" class="range"></div>' +
            '</header>' +
            '<div class="editor">' +
            '<div id="code-lines"></div>' +
            '</div>' +
            '<footer>' +
            '<div id="status" class="status">选中代码后使用 Code Path 菜单，可通过 Ctrl+Enter 快速保存。</div>' +
            '<div class="actions">' +
            '<button class="secondary" id="cancel-btn">取消</button>' +
            '<button id="save-btn">保存</button>' +
            '</div>' +
            '</footer>' +
            '<script>' +
            'const vscodeApi = acquireVsCodeApi();' +
            'const linesContainer = document.getElementById("code-lines");' +
            'const fileLabel = document.getElementById("file-label");' +
            'const rangeLabel = document.getElementById("range-label");' +
            'const statusEl = document.getElementById("status");' +
            'const autoResize = (input) => { if (!input) return; input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };' +
            'const buildLines = (text, startLine) => {' +
            '  if (!linesContainer) return;' +
            '  const normalized = (text || "").replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");' +
            '  const lines = normalized.split("\\n");' +
            '  linesContainer.innerHTML = "";' +
            '  lines.forEach((line, index) => {' +
            '    const row = document.createElement("div");' +
            '    row.className = "code-line-row";' +
            '    const number = document.createElement("div");' +
            '    number.className = "code-line-number";' +
            '    number.textContent = String(startLine + index);' +
            '    const input = document.createElement("textarea");' +
            '    input.className = "code-line-input";' +
            '    input.spellcheck = false;' +
            '    input.wrap = "soft";' +
            '    input.value = line;' +
            '    autoResize(input);' +
            '    input.addEventListener("input", () => autoResize(input));' +
            '    row.appendChild(number);' +
            '    row.appendChild(input);' +
            '    linesContainer.appendChild(row);' +
            '  });' +
            '};' +
            'const collectText = () => {' +
            '  if (!linesContainer) return "";' +
            '  const inputs = Array.from(linesContainer.querySelectorAll(".code-line-input"));' +
            '  const parts = inputs.map(input => {' +
            '    const val = input.value || "";' +
            '    return val.replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");' +
            '  });' +
            '  if (parts.length === 0) return "";' +
            '  if (parts.length === 1) return parts[0];' +
            '  return parts.join("\\n");' +
            '};' +
            'window.addEventListener("message", (event) => {' +
            '  const { type, payload } = event.data || {};' +
            '  if (type === "update" && payload) {' +
            '    buildLines(payload.text || "", payload.startLine || 1);' +
            '    if (fileLabel) fileLabel.textContent = payload.fileLabel || "";' +
            '    if (rangeLabel) rangeLabel.textContent = payload.rangeLabel || "";' +
            '    if (statusEl) statusEl.textContent = "可直接编辑内容，Ctrl+Enter 保存。";' +
            '  }' +
            '  if (type === "saved") {' +
            '    if (statusEl) { statusEl.textContent = "已保存 ✔"; setTimeout(() => { statusEl.textContent = ""; }, 2000); }' +
            '  }' +
            '});' +
            'document.getElementById("save-btn").addEventListener("click", () => {' +
            '  vscodeApi.postMessage({ type: "save", value: collectText() });' +
            '});' +
            'document.getElementById("cancel-btn").addEventListener("click", () => {' +
            '  vscodeApi.postMessage({ type: "cancel" });' +
            '});' +
            'if (linesContainer) {' +
            '  linesContainer.addEventListener("keydown", (event) => {' +
            '    if (event.ctrlKey && event.key === "Enter") {' +
            '      vscodeApi.postMessage({ type: "save", value: collectText() });' +
            '      event.preventDefault();' +
            '    }' +
            '  });' +
            '}' +
            '</script>' +
            '</body>' +
            '</html>';
        return html;
    }

    private advancePosition(start: vscode.Position, content: string): vscode.Position {
        const normalized = content.replace(/\r\n/g, '\n');
        const segments = normalized.split('\n');
        if (segments.length === 1) {
            return new vscode.Position(start.line, start.character + segments[0].length);
        }

        const lastSegment = segments[segments.length - 1];
        return new vscode.Position(start.line + segments.length - 1, lastSegment.length);
    }

    private buildRangeLabel(range: vscode.Range): string {
        const startLine = range.start.line + 1;
        const endLine = this.getInclusiveEndLine(range) + 1;

        if (startLine === endLine) {
            const startColumn = range.start.character + 1;
            const endColumn = range.end.character + 1;
            return `第 ${startLine} 行（列 ${startColumn}-${endColumn}）`;
        }

        return `第 ${startLine}-${endLine} 行`;
    }

    private getInclusiveEndLine(range: vscode.Range): number {
        if (range.end.character === 0 && range.end.line > range.start.line) {
            return range.end.line - 1;
        }
        return range.end.line;
    }

    private getFileLabel(document: vscode.TextDocument): string {
        const relative = vscode.workspace.asRelativePath
            ? vscode.workspace.asRelativePath(document.uri, false)
            : '';
        if (relative && relative !== document.uri.fsPath) {
            return relative;
        }

        const segments = document.fileName?.split(/[/\\]/) ?? [];
        return segments.length ? segments[segments.length - 1] : document.uri.fsPath;
    }

    private updateContext(isEnabled: boolean): void {
        executeCommandSafely('setContext', 'codepath.hasSelectionForPopup', isEnabled);
    }

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] | undefined {
        if (context.only && !context.only.contains(vscode.CodeActionKind.QuickFix)) {
            return undefined;
        }

        const selection = range instanceof vscode.Selection ? range : new vscode.Selection(range.start, range.end);
        if (selection.isEmpty) {
            return undefined;
        }

        const snapshot = this.createSnapshot(document, selection);
        if (!snapshot) {
            return undefined;
        }

        const action = new vscode.CodeAction('🪧 行内容弹窗编辑', vscode.CodeActionKind.QuickFix);
        action.command = {
            title: '🪧 行内容弹窗编辑',
            command: 'codepath.showSelectionPopup'
        };
        const actions: vscode.CodeAction[] = [];
        actions.push(action);

        const copyContextAction = new vscode.CodeAction('📋 Copy Code Context', vscode.CodeActionKind.QuickFix);
        copyContextAction.command = {
            title: '📋 Copy Code Context',
            command: 'codepath.copyCodeContext'
        };
        actions.push(copyContextAction);

        return actions;
    }

    public static normalizeSelection(_document: vscode.TextDocument, selection: vscode.Selection): vscode.Range | null {
        if (!selection || selection.isEmpty) {
            return null;
        }
        return new vscode.Range(selection.start, selection.end);
    }
}
