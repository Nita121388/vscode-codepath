import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CommandManager } from '../managers/CommandManager';
import { GraphManager } from '../managers/GraphManager';
import { NodeManager } from '../managers/NodeManager';
import { IntegrationManager } from '../managers/IntegrationManager';

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

describe('File/Folder Context Integration Tests', () => {
    let commandManager: CommandManager;
    let mockGraphManager: any;
    let mockNodeManager: any;
    let mockIntegrationManager: any;

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
            refreshPreviewAndReveal: vi.fn(),
            showPreview: vi.fn(),
            togglePreviewFormat: vi.fn(),
            getState: vi.fn(() => ({ hasCurrentNode: false, hasGraph: false })),
            getNodeManager: vi.fn(() => mockNodeManager)
        };

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

    describe('End-to-End File Context Workflows', () => {
        it('should create node from TypeScript file', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/components/Button.tsx');
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'button-node',
                name: 'Button.tsx',
                filePath: '/workspace/src/components/Button.tsx',
                lineNumber: 1
            });

            // Act
            await (commandManager as any).handleMarkAsNewNode(testUri);

            // Assert
            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'Button.tsx',
                '/workspace/src/components/Button.tsx',
                1
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为新节点: Button.tsx'
            );
        });

        it('should create child node from folder', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/utils');
            const mockStats = { type: vscode.FileType.Directory };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createChildNodeWorkflow.mockResolvedValue({
                id: 'utils-node',
                name: 'utils',
                filePath: '/workspace/src/utils',
                lineNumber: 1
            });

            // Act
            await (commandManager as any).handleMarkAsChildNode(testUri);

            // Assert
            expect(mockIntegrationManager.createChildNodeWorkflow).toHaveBeenCalledWith(
                'utils',
                '/workspace/src/utils',
                1
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为子节点: utils'
            );
        });

        it('should handle complex file paths correctly', async () => {
            // Arrange
            const testUri = vscode.Uri.file('/workspace/src/features/user-management/components/UserProfile.component.ts');
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createParentNodeWorkflow.mockResolvedValue({
                id: 'user-profile-node',
                name: 'UserProfile.component.ts',
                filePath: '/workspace/src/features/user-management/components/UserProfile.component.ts',
                lineNumber: 1
            });

            // Act
            await (commandManager as any).handleMarkAsParentNode(testUri);

            // Assert
            expect(mockIntegrationManager.createParentNodeWorkflow).toHaveBeenCalledWith(
                'UserProfile.component.ts',
                '/workspace/src/features/user-management/components/UserProfile.component.ts',
                1
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为父节点: UserProfile.component.ts'
            );
        });

        it('should work with different file extensions', async () => {
            const testCases = [
                { path: '/workspace/package.json', name: 'package.json' },
                { path: '/workspace/README.md', name: 'README.md' },
                { path: '/workspace/src/main.py', name: 'main.py' },
                { path: '/workspace/styles/main.css', name: 'main.css' },
                { path: '/workspace/config/webpack.config.js', name: 'webpack.config.js' }
            ];

            for (const testCase of testCases) {
                // Arrange
                const testUri = vscode.Uri.file(testCase.path);
                const mockStats = { type: vscode.FileType.File };
                
                vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
                mockIntegrationManager.createBroNodeWorkflow.mockResolvedValue({
                    id: `${testCase.name}-node`,
                    name: testCase.name,
                    filePath: testCase.path,
                    lineNumber: 1
                });

                // Act
                await (commandManager as any).handleMarkAsBroNode(testUri);

                // Assert
                expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                    testCase.name,
                    testCase.path,
                    1
                );
            }
        });
    });

    describe('Requirements Compliance', () => {
        it('should satisfy requirement 9.1: Show all node creation options for files', async () => {
            // This test verifies that all "Mark as" commands work with file URIs
            const testUri = vscode.Uri.file('/workspace/test.js');
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);

            const commands = [
                { handler: 'handleMarkAsNewNode', workflow: 'createNodeWorkflow' },
                { handler: 'handleMarkAsChildNode', workflow: 'createChildNodeWorkflow' },
                { handler: 'handleMarkAsParentNode', workflow: 'createParentNodeWorkflow' },
                { handler: 'handleMarkAsBroNode', workflow: 'createBroNodeWorkflow' }
            ];

            for (const command of commands) {
                mockIntegrationManager[command.workflow].mockResolvedValue({
                    id: 'test-node',
                    name: 'test.js',
                    filePath: '/workspace/test.js',
                    lineNumber: 1
                });

                await (commandManager as any)[command.handler](testUri);

                expect(mockIntegrationManager[command.workflow]).toHaveBeenCalledWith(
                    'test.js',
                    '/workspace/test.js',
                    1
                );
            }
        });

        it('should satisfy requirement 9.2: Show all node creation options for folders', async () => {
            // This test verifies that all "Mark as" commands work with folder URIs
            const testUri = vscode.Uri.file('/workspace/src');
            const mockStats = { type: vscode.FileType.Directory };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);

            const commands = [
                { handler: 'handleMarkAsNewNode', workflow: 'createNodeWorkflow' },
                { handler: 'handleMarkAsChildNode', workflow: 'createChildNodeWorkflow' },
                { handler: 'handleMarkAsParentNode', workflow: 'createParentNodeWorkflow' },
                { handler: 'handleMarkAsBroNode', workflow: 'createBroNodeWorkflow' }
            ];

            for (const command of commands) {
                mockIntegrationManager[command.workflow].mockResolvedValue({
                    id: 'src-node',
                    name: 'src',
                    filePath: '/workspace/src',
                    lineNumber: 1
                });

                await (commandManager as any)[command.handler](testUri);

                expect(mockIntegrationManager[command.workflow]).toHaveBeenCalledWith(
                    'src',
                    '/workspace/src',
                    1
                );
            }
        });

        it('should satisfy requirement 9.3: Use file/folder name as node name', async () => {
            const testCases = [
                { path: '/workspace/MyComponent.tsx', expectedName: 'MyComponent.tsx' },
                { path: '/workspace/src/utils', expectedName: 'utils' },
                { path: '/workspace/very-long-folder-name', expectedName: 'very-long-folder-name' }
            ];

            for (const testCase of testCases) {
                const testUri = vscode.Uri.file(testCase.path);
                const mockStats = { type: vscode.FileType.File };
                
                vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
                mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                    id: 'test-node',
                    name: testCase.expectedName,
                    filePath: testCase.path,
                    lineNumber: 1
                });

                await (commandManager as any).handleMarkAsNewNode(testUri);

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    testCase.expectedName,
                    testCase.path,
                    1
                );
            }
        });

        it('should satisfy requirement 9.4: Use file/folder path as node path', async () => {
            const testPath = '/workspace/src/components/Button.tsx';
            const testUri = vscode.Uri.file(testPath);
            const mockStats = { type: vscode.FileType.File };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'button-node',
                name: 'Button.tsx',
                filePath: testPath,
                lineNumber: 1
            });

            await (commandManager as any).handleMarkAsNewNode(testUri);

            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'Button.tsx',
                testPath, // Exact path should be used
                1
            );
        });

        it('should satisfy requirement 9.5: Set line number to 1 for folders', async () => {
            const testUri = vscode.Uri.file('/workspace/src/components');
            const mockStats = { type: vscode.FileType.Directory };
            
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue(mockStats);
            mockIntegrationManager.createNodeWorkflow.mockResolvedValue({
                id: 'components-node',
                name: 'components',
                filePath: '/workspace/src/components',
                lineNumber: 1
            });

            await (commandManager as any).handleMarkAsNewNode(testUri);

            expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                'components',
                '/workspace/src/components',
                1 // Line number should always be 1 for folders
            );
        });
    });
});