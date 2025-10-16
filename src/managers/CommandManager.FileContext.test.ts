import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CommandManager } from './CommandManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { IntegrationManager } from './IntegrationManager';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInputBox: vi.fn(),
        showQuickPick: vi.fn(),
        showSaveDialog: vi.fn(),
        showOpenDialog: vi.fn(),
        createOutputChannel: vi.fn(() => ({
            clear: vi.fn(),
            appendLine: vi.fn(),
            show: vi.fn()
        }))
    },
    workspace: {
        fs: {
            stat: vi.fn(),
            readFile: vi.fn(),
            writeFile: vi.fn()
        },
        workspaceFolders: [],
        openTextDocument: vi.fn(),
        onDidSaveTextDocument: vi.fn()
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    env: {
        clipboard: {
            writeText: vi.fn()
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file' }))
    },
    FileType: {
        Directory: 2,
        File: 1
    },
    FileSystemError: class extends Error {
        code: string;
        constructor(message: string, code: string) {
            super(message);
            this.code = code;
        }
    },
    ViewColumn: {
        One: 1,
        Two: 2
    },
    Position: vi.fn(),
    Selection: vi.fn(),
    Range: vi.fn(),
    TextEditorRevealType: {
        InCenter: 1
    }
}));

describe('CommandManager File/Folder Context Support', () => {
    let commandManager: CommandManager;
    let mockGraphManager: any;
    let mockNodeManager: any;
    let mockIntegrationManager: any;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Create mocks
        mockGraphManager = {
            getCurrentGraph: vi.fn(),
            createGraph: vi.fn(),
            loadGraph: vi.fn(),
            saveGraph: vi.fn(),
            deleteGraph: vi.fn(),
            listGraphs: vi.fn(),
            exportGraph: vi.fn(),
            importGraph: vi.fn()
        };

        mockNodeManager = {
            getCurrentNode: vi.fn(),
            createNode: vi.fn(),
            updateNode: vi.fn(),
            deleteNode: vi.fn(),
            deleteNodeWithChildren: vi.fn(),
            getNode: vi.fn(),
            validateAllNodes: vi.fn()
        };

        mockIntegrationManager = {
            createNodeWorkflow: vi.fn(),
            createChildNodeWorkflow: vi.fn(),
            createParentNodeWorkflow: vi.fn(),
            createBroNodeWorkflow: vi.fn(),
            switchNodeWorkflow: vi.fn(),
            switchGraphWorkflow: vi.fn(),
            updatePreview: vi.fn(),
            showPreview: vi.fn(),
            togglePreviewFormat: vi.fn(),
            getState: vi.fn(() => ({ hasCurrentNode: false, hasGraph: false })),
            getNodeManager: vi.fn(() => mockNodeManager)
        };

        mockContext = {
            subscriptions: []
        } as any;

        // Create CommandManager instance
        commandManager = new CommandManager(
            mockGraphManager,
            mockNodeManager,
            mockIntegrationManager
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('File Context Support', () => {
        it('should create node from file URI with correct name and path', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/test.ts');
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'test.ts',
                filePath: '/workspace/src/test.ts',
                lineNumber: 1
            } as any);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);

            // Assert
            expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(testUri);
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'test.ts',
                '/workspace/src/test.ts',
                1
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为新节点: test.ts'
            );
        });

        it('should create node from folder URI with line number 1', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/components');
            const mockStats = { type: vscode.FileType.Directory };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createChildNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'components',
                filePath: '/workspace/src/components',
                lineNumber: 1
            } as any);

            // Act
            await (commandManager as any).handleMarkAsChildNode(testUri);

            // Assert
            expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(testUri);
            expect(mockIntegrationManager.createChildNodeWorkflow).toHaveBeenCalledWith(
                'components',
                '/workspace/src/components',
                1
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为子节点: components'
            );
        });

        it('should handle file not found error', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/nonexistent/file.ts');
            const fileSystemError = new (vscode.FileSystemError as any)('File not found', 'FileNotFound');
            
            vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(fileSystemError);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('选中的文件或文件夹不存在')
            );
        });

        it('should handle permission denied error', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/restricted/file.ts');
            const fileSystemError = new (vscode.FileSystemError as any)('No permissions', 'NoPermissions');
            
            vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(fileSystemError);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('没有权限访问')
            );
        });
    });

    describe('Path Validation', () => {
        it('should reject paths that are too long', async () => {
            // Arrange
            const longPath = '/workspace/' + 'a'.repeat(300) + '.ts';
            const testUri = vscode.Uri.file(longPath);
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('文件路径过长')
            );
        });

        it('should reject paths with invalid characters', async () => {
            // Arrange
            const invalidPath = '/workspace/test<file>.ts';
            const testUri = vscode.Uri.file(invalidPath);
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('文件路径包含无效字符')
            );
        });

        it('should reject reserved file names on Windows', async () => {
            // Arrange
            const reservedPath = '/workspace/CON.ts';
            const testUri = vscode.Uri.file(reservedPath);
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('系统保留名称')
            );
        });
    });

    describe('Node Name Generation', () => {
        it('should use file name as node name', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/MyComponent.tsx');
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'MyComponent.tsx',
                filePath: '/workspace/src/MyComponent.tsx',
                lineNumber: 1
            } as any);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);

            // Assert
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'MyComponent.tsx',
                '/workspace/src/MyComponent.tsx',
                1
            );
        });

        it('should use folder name as node name', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/utils');
            const mockStats = { type: vscode.FileType.Directory };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'utils',
                filePath: '/workspace/src/utils',
                lineNumber: 1
            } as any);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);

            // Assert
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'utils',
                '/workspace/src/utils',
                1
            );
        });

        it('should truncate very long file names', async () => {
            // Arrange
            const longFileName = 'a'.repeat(60) + '.ts';
            const testUri = vscode.Uri.file(`/workspace/${longFileName}`);
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'a'.repeat(47) + '...',
                filePath: `/workspace/${longFileName}`,
                lineNumber: 1
            } as any);

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);

            // Assert
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'a'.repeat(47) + '...',
                `/workspace/${longFileName}`,
                1
            );
        });
    });

    describe('Fallback to Editor Context', () => {
        it('should fall back to active editor when no URI provided and no text selected', async () => {
            // Arrange
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/workspace/current.ts'),
                    getText: vi.fn(() => '')
                },
                selection: {
                    start: { line: 5 }
                }
            };
            
            (vscode.window as any).activeTextEditor = mockEditor;
            const mockStats = { type: vscode.FileType.File };
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'test-node',
                name: 'current.ts',
                filePath: '/workspace/current.ts',
                lineNumber: 6
            } as any);

            // Act
            await (commandManager as any).handleMarkAsNewNode();

            // Assert
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'current.ts',
                '/workspace/current.ts',
                6 // Current cursor line
            );
        });

        it('should throw error when no context available', async () => {
            // Arrange
            (vscode.window as any).activeTextEditor = null;

            // Act
            await (commandManager as any).handleMarkAsNewNode();
            
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('未找到活动编辑器或选中的文件/文件夹')
            );
        });
    });

    describe('All Mark As Commands', () => {
        const testCases = [
            { method: 'handleMarkAsNewNode', workflow: 'createNodeWorkflow', message: '已标记为新节点' },
            { method: 'handleMarkAsChildNode', workflow: 'createChildNodeWorkflow', message: '已标记为子节点' },
            { method: 'handleMarkAsParentNode', workflow: 'createParentNodeWorkflow', message: '已标记为父节点' },
            { method: 'handleMarkAsBroNode', workflow: 'createBroNodeWorkflow', message: '已标记为兄弟节点' }
        ];

        testCases.forEach(({ method, workflow, message }) => {
            it(`should support file/folder context for ${method}`, async () => {
                // Arrange
                const testUri = vscode.Uri.file('/workspace/test.js');
                const mockStats = { type: vscode.FileType.File };
                
                vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
                (mockIntegrationManager as any)[workflow].mockResolvedValue({
                    id: 'test-node',
                    name: 'test.js',
                    filePath: '/workspace/test.js',
                    lineNumber: 1
                });

                // Act
                await (commandManager as any)[method](testUri);

                // Assert
                expect((mockIntegrationManager as any)[workflow]).toHaveBeenCalledWith(
                    'test.js',
                    '/workspace/test.js',
                    1
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                    `${message}: test.js`
                );
            });
        });
    });
});