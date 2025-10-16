// Mock VS Code API for testing
export const workspace = {
    workspaceFolders: [{
        uri: { fsPath: '/test/workspace' }
    }]
};

export const window = {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showQuickPick: () => Promise.resolve(),
    visibleTextEditors: [],
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => {},
        hide: () => {},
        dispose: () => {}
    }),
    createWebviewPanel: () => ({
        webview: {
            html: '',
            onDidReceiveMessage: () => ({ dispose: () => {} }),
            postMessage: () => Promise.resolve()
        },
        onDidDispose: () => ({ dispose: () => {} }),
        reveal: () => {},
        dispose: () => {},
        visible: true
    })
};

export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: () => Promise.resolve()
};

export const Uri = {
    file: (path: string) => ({ fsPath: path }),
    joinPath: (base: any, ...paths: string[]) => ({ fsPath: `${base.fsPath}/${paths.join('/')}` })
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const ViewColumn = {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
};

export class MarkdownString {
    public value: string;
    public isTrusted?: boolean;
    public supportThemeIcons?: boolean;

    constructor(value?: string) {
        this.value = value || '';
    }

    appendText(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendMarkdown(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendCodeblock(value: string, language?: string): MarkdownString {
        this.value += `\`\`\`${language || ''}\n${value}\n\`\`\``;
        return this;
    }
}

export default {
    workspace,
    window,
    commands,
    Uri,
    StatusBarAlignment,
    ViewColumn,
    MarkdownString
};