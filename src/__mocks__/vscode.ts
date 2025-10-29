// Mock VS Code API for测试环境
// 为确保各个单元测试场景能够覆盖 VS Code 相关依赖，这里提供比较完整的桩实现。
import { vi } from 'vitest';

// 创建一个模拟的 HTML 模板文件内容
const mockHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src {{cspSource}} 'unsafe-inline'; script-src 'nonce-{{nonce}}';">
    <title>CodePath Preview</title>
</head>
<body>
    <div id="content">{{content}}</div>
    <script nonce="{{nonce}}">
        // Mock script content
    </script>
</body>
</html>`;

// Mock Node.js fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn((path: string) => {
        if (path.includes('preview.html') || path.includes('media')) {
            return mockHtmlTemplate;
        }
        return 'const test = "mock content";';
    }),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
}));

type Disposable = { dispose: () => void };
type OutputChannel = Disposable & {
    append: (value: string) => void;
    appendLine: (value: string) => void;
    replace: (value: string) => void;
    show: () => void;
    hide: () => void;
    clear: () => void;
};

const createDisposable = (): Disposable => ({ dispose: vi.fn() });
const createOutputChannel = (): OutputChannel => ({
    append: vi.fn(),
    appendLine: vi.fn(),
    replace: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn()
});

export const workspace = {
    workspaceFolders: [{
        uri: { fsPath: process.platform === 'win32' ? 'C:\\test\\workspace' : '/test/workspace' }
    }],
    getConfiguration: vi.fn((_section?: string) => ({
        get: vi.fn(<T>(_key: string, _defaultValue?: T): T | undefined => _defaultValue),
        update: vi.fn((_key: string, _value: any) => Promise.resolve()),
        has: vi.fn((_key: string) => false),
        inspect: vi.fn((_key: string) => undefined)
    })),
    openTextDocument: vi.fn((uri) => {
        const path = typeof uri === 'string' ? uri : (uri.fsPath || uri.toString());
        
        // 检查是否是不存在的文件路径
        if (path.includes('/non/existent/') || path.includes('\\non\\existent\\')) {
            const error = new Error('File not found');
            (error as any).code = 'ENOENT';
            return Promise.reject(error);
        }
        
        // 为测试文件返回模拟的文档内容
        let content = 'const test = "mock content";';
        let lineCount = 1;
        
        if (path.includes('test-location-tracker.ts')) {
            content = 'line 1\nline 2\nline 3';
            lineCount = 3;
        } else if (path.includes('test-location-exact.ts')) {
            content = 'function test() {\n  return 42;\n}';
            lineCount = 3;
        } else if (path.includes('test-location-moved.ts')) {
            content = 'line 1\nline 2\nfunction test() {\n  return 42;\n}\nline 6';
            lineCount = 6;
        } else if (path.includes('test-navigate.ts')) {
            content = 'function test() {\n  return 42;\n}';
            lineCount = 3;
        } else if (path.includes('test-navigate-moved.ts')) {
            content = 'line 1\nline 2\nfunction test() {\n  return 42;\n}\nline 6';
            lineCount = 6;
        } else if (path.includes('test-update-location.ts')) {
            content = 'function test() {\nreturn 42;\n}';
            lineCount = 3;
        }
        
        const lines = content.split('\n');
        
        return Promise.resolve({
            getText: () => content,
            uri: { fsPath: path },
            lineCount: lineCount,
            lineAt: (index: number) => ({
                text: lines[index] || '',
                lineNumber: index,
                range: { start: { line: index, character: 0 }, end: { line: index, character: (lines[index] || '').length } }
            })
        });
    }),
    fs: {
        writeFile: vi.fn(() => Promise.resolve()),
        readFile: vi.fn((uri) => {
            // 如果是请求 HTML 模板文件，返回模拟的模板内容
            if (uri.fsPath && uri.fsPath.includes('preview.html')) {
                return Promise.resolve(Buffer.from(mockHtmlTemplate));
            }
            return Promise.resolve(Buffer.from('const test = "mock content";'));
        }),
        stat: vi.fn((uri) => {
            // 模拟文件系统状态，对于不存在的文件抛出错误
            const path = uri.fsPath || uri.toString();
            
            // 检查是否是不存在的文件路径
            if (path.includes('/non/existent/') || path.includes('\\non\\existent\\')) {
                const error = new Error('File not found');
                (error as any).code = 'ENOENT';
                return Promise.reject(error);
            }
            
            // 对于测试文件，返回适当的类型
            if (path.includes('example.ts') || path.includes('test') || path.includes('.ts') || path.includes('.js')) {
                return Promise.resolve({ 
                    type: 1, // FileType.File
                    size: 100,
                    ctime: Date.now(),
                    mtime: Date.now()
                });
            }
            
            // 默认返回目录类型
            return Promise.resolve({ 
                type: 2, // FileType.Directory
                size: 0,
                ctime: Date.now(),
                mtime: Date.now()
            });
        }),
        createDirectory: vi.fn(() => Promise.resolve()),
        delete: vi.fn(() => Promise.resolve())
    },
    onDidChangeConfiguration: () => createDisposable()
};

export const window = {
    showInformationMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showErrorMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showWarningMessage: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showQuickPick: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showOpenDialog: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showSaveDialog: vi.fn((..._args: any[]) => Promise.resolve(undefined)),
    showTextDocument: vi.fn((document, options) => {
        // 模拟编辑器对象
        const mockEditor = {
            document: document,
            selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            revealRange: vi.fn(),
            edit: vi.fn(() => Promise.resolve(true))
        };
        return Promise.resolve(mockEditor);
    }),
    visibleTextEditors: [] as any[],
    createStatusBarItem: vi.fn(() => ({
        text: '',
        tooltip: '',
        command: '',
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn()
    })),
    createWebviewPanel: vi.fn((..._args: any[]) => ({
        webview: {
            html: '',
            onDidReceiveMessage: vi.fn(() => createDisposable()),
            postMessage: vi.fn(() => Promise.resolve(true))
        },
        onDidDispose: vi.fn(() => createDisposable()),
        reveal: vi.fn(),
        dispose: vi.fn(),
        visible: true
    })),
    createOutputChannel: vi.fn(() => createOutputChannel()),
    registerWebviewViewProvider: vi.fn((..._args: any[]) => createDisposable()),
    withProgress: vi.fn((_options: any, task: () => Promise<any>) => task())
};

export const commands = {
    registerCommand: vi.fn((_command: string, _callback: (...args: any[]) => unknown) => createDisposable()),
    executeCommand: vi.fn((command: string, ..._args: any[]) => {
        // Return appropriate values for different commands
        if (command === 'getContext') {
            return Promise.resolve(false); // Default context value
        }
        return Promise.resolve(undefined);
    }),
    setContext: vi.fn((_key: string, _value: any) => Promise.resolve())
};

export const env = {
    openExternal: (_uri: any) => Promise.resolve(true)
};

// Mock extension context
export const mockExtensionContext = {
    extensionUri: { fsPath: process.cwd(), scheme: 'file' }, // Use current working directory
    subscriptions: [],
    workspaceState: {
        get: vi.fn(),
        update: vi.fn()
    },
    globalState: {
        get: vi.fn(),
        update: vi.fn()
    }
};

export const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: 'file' }),
    joinPath: (base: any, ...paths: string[]) => {
        const basePath = base && base.fsPath ? base.fsPath : (base || '');
        const separator = process.platform === 'win32' ? '\\' : '/';
        const fullPath = basePath ? `${basePath}${separator}${paths.join(separator)}` : paths.join(separator);
        return { fsPath: fullPath, scheme: 'file' };
    },
    parse: (value: string) => ({ fsPath: value, scheme: 'file' })
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

export const FileType = {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
};

export class Position {
    public line: number;
    public character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }
}

export class Range {
    public start: Position;
    public end: Position;

    constructor(start: Position, end: Position) {
        this.start = start;
        this.end = end;
    }
}

export class Selection extends Range {
    public anchor: Position;
    public active: Position;

    constructor(anchor: Position, active: Position) {
        super(anchor, active);
        this.anchor = anchor;
        this.active = active;
    }
}

export const TextEditorRevealType = {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3
};

export class FileSystemError extends Error {
    public code: string;
    
    static FileNotFound(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('File not found');
        error.code = 'FileNotFound';
        return error;
    }
    
    static FileExists(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('File exists');
        error.code = 'FileExists';
        return error;
    }
    
    static FileIsADirectory(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('File is a directory');
        error.code = 'FileIsADirectory';
        return error;
    }
    
    static FileNotADirectory(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('File not a directory');
        error.code = 'FileNotADirectory';
        return error;
    }
    
    static NoPermissions(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('No permissions');
        error.code = 'NoPermissions';
        return error;
    }
    
    static Unavailable(messageOrUri?: string | any): FileSystemError {
        const error = new FileSystemError('Unavailable');
        error.code = 'Unavailable';
        return error;
    }
    
    constructor(message?: string) {
        super(message);
        this.name = 'FileSystemError';
        this.code = 'Unknown';
    }
}

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

// FileSystemError is already exported as a class above

// Default export for compatibility
export default {
    workspace,
    window,
    commands,
    env,
    Uri,
    StatusBarAlignment,
    ViewColumn,
    FileType,
    FileSystemError,
    MarkdownString,
    Position,
    Range,
    Selection,
    TextEditorRevealType
};
