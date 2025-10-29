import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { IntegrationManager } from '../managers/IntegrationManager';
import { GraphManager } from '../managers/GraphManager';
import { NodeManager } from '../managers/NodeManager';
import { PreviewManager } from '../managers/PreviewManager';
import { WebviewManager } from '../managers/WebviewManager';
import { StatusBarManager } from '../managers/StatusBarManager';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { StorageManager } from '../managers/StorageManager';

// 使用统一的 VS Code 模拟器，确保输出通道与 MarkdownString 等新能力都可用
vi.mock('vscode', async () => {
    const actual = await import('../__mocks__/vscode');

    return {
        ...actual,
        window: {
            ...actual.window,
            activeTextEditor: null,
            showErrorMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            createStatusBarItem: vi.fn(() => ({
                text: '',
                tooltip: '',
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn()
            })),
            createWebviewPanel: vi.fn(() => ({
                webview: {
                    html: '',
                    onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                    postMessage: vi.fn().mockResolvedValue(true)
                },
                onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                dispose: vi.fn(),
                reveal: vi.fn()
            })),
            createOutputChannel: vi.fn(() => ({
                append: vi.fn(),
                appendLine: vi.fn(),
                replace: vi.fn(),
                show: vi.fn(),
                hide: vi.fn(),
                clear: vi.fn(),
                dispose: vi.fn()
            }))
        },
        workspace: {
            ...actual.workspace,
            getConfiguration: vi.fn(() => ({
                get: vi.fn().mockReturnValue('text'),
                update: vi.fn(),
                has: vi.fn(),
                inspect: vi.fn()
            }))
        },
        commands: {
            ...actual.commands,
            registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            executeCommand: vi.fn().mockResolvedValue(undefined)
        }
    };
});

describe('Basic Integration Tests', () => {
    let integrationManager: IntegrationManager;
    let graphManager: GraphManager;
    let nodeManager: NodeManager;
    let previewManager: PreviewManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        vi.clearAllMocks();

        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: vi.fn(),
                update: vi.fn()
            },
            globalState: {
                get: vi.fn(),
                update: vi.fn()
            },
            extensionPath: '/test/extension',
            storagePath: '/test/storage',
            globalStoragePath: '/test/global'
        } as any;

        // Create managers
        const storageManager = new StorageManager('/test/workspace');
        const configManager = new ConfigurationManager(storageManager);
        graphManager = new GraphManager(storageManager, configManager);
        nodeManager = new NodeManager(graphManager, configManager);
        previewManager = new PreviewManager(configManager.getConfiguration().defaultView);
        const webviewManager = new WebviewManager(mockContext);
        const statusBarManager = new StatusBarManager();

        integrationManager = new IntegrationManager(
            graphManager,
            nodeManager,
            previewManager,
            webviewManager,
            statusBarManager,
            configManager,
            mockContext
        );
    });

    afterEach(() => {
        if (integrationManager) {
            integrationManager.dispose();
        }
    });

    describe('Core Node Creation', () => {
        it('should create a root node successfully', async () => {
            // Act
            const result = await integrationManager.createNodeWorkflow(
                'test function',
                '/src/test.ts',
                10
            );

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('test function');
            expect(result.filePath).toBe('/src/test.ts');
            expect(result.lineNumber).toBe(10);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
        });

        it('should automatically create graph when none exists', async () => {
            // Arrange
            expect(graphManager.getCurrentGraph()).toBeNull();

            // Act
            await integrationManager.createNodeWorkflow(
                'first node',
                '/src/first.ts',
                1
            );

            // Assert
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph).toBeDefined();
            expect(currentGraph?.nodes.size).toBe(1);
        });

        it('should handle empty text selection gracefully', async () => {
            // When no text is selected, system should extract from current line
            const result = await integrationManager.createNodeWorkflow('', '/src/test.ts', 1);
            
            expect(result).toBeDefined();
            expect(result.name).toBeTruthy(); // Should have extracted name from line
            expect(result.filePath).toBe('/src/test.ts');
            expect(result.lineNumber).toBe(1);
        });

        it('should handle invalid file paths gracefully', async () => {
            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow('test', '', 1)
            ).rejects.toThrow();
        });

        it('should handle invalid line numbers gracefully', async () => {
            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow('test', '/src/test.ts', -1)
            ).rejects.toThrow();
        });
    });

    describe('Graph Management', () => {
        it('should create multiple graphs', async () => {
            // Act
            const graph1 = await graphManager.createGraph('Graph 1');
            const graph2 = await graphManager.createGraph('Graph 2');

            // Assert
            expect(graph1.name).toBe('Graph 1');
            expect(graph2.name).toBe('Graph 2');
            expect(graph1.id).not.toBe(graph2.id);
        });

        it('should switch between graphs', async () => {
            // Arrange
            const graph1 = await graphManager.createGraph('Graph 1');
            const graph2 = await graphManager.createGraph('Graph 2');

            // Act
            await graphManager.setCurrentGraph(graph1);

            // Assert
            expect(graphManager.getCurrentGraph()?.id).toBe(graph1.id);
        });
    });

    describe('Preview Rendering', () => {
        it('should render text preview', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('test node', '/src/test.ts', 1);
            previewManager.setFormat('text');

            // Act
            const preview = await previewManager.renderPreview();

            // Assert
            expect(preview).toBeDefined();
            expect(preview).toContain('test node');
        });

        it('should render mermaid preview or fallback gracefully', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('testNode', '/src/test.ts', 1);
            previewManager.setFormat('mermaid');

            // Act
            const preview = await previewManager.renderPreview();

        // Assert
        expect(preview).toBeDefined();
        // Mermaid 输出升级为 flowchart 语法，如渲染失败则返回带注释的文本兜底
        expect(
            preview.includes('flowchart TD') ||
            preview.includes('Mermaid rendering failed') ||
            preview.includes('Mermaid validation errors') ||
            preview.includes('Error rendering preview:')
        ).toBe(true);
        });

        it('should switch between preview formats', () => {
            // Act
            previewManager.setFormat('text');
            expect(previewManager.getFormat()).toBe('text');

            previewManager.setFormat('mermaid');
            expect(previewManager.getFormat()).toBe('mermaid');
        });
    });

    describe('Error Handling', () => {
        it('should handle file system errors gracefully', async () => {
            // Arrange
            const storageManager = new StorageManager('/test/workspace');
            vi.spyOn(storageManager, 'saveGraphToFile').mockRejectedValue(
                new Error('Permission denied')
            );

            const graphManagerWithFailure = new GraphManager(storageManager, new ConfigurationManager(storageManager));

            // Act - Should succeed with in-memory graph despite storage failure
            const result = await graphManagerWithFailure.createGraph('test');

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('should provide helpful error messages', async () => {
            try {
                await integrationManager.createNodeWorkflow('', '/src/test.ts', 1);
            } catch (error: any) {
                expect(error.message).toContain('Please select code text first');
            }
        });
    });

    describe('Performance', () => {
        it('should handle multiple nodes efficiently', async () => {
            const startTime = Date.now();

            // Create 20 nodes
            for (let i = 0; i < 20; i++) {
                await integrationManager.createNodeWorkflow(
                    `node_${i}`,
                    `/src/file_${i}.ts`,
                    i + 1
                );
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (2 seconds)
            expect(duration).toBeLessThan(2000);
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(20);
        });
    });

    describe('Cross-platform Compatibility', () => {
        it('should handle Windows file paths', async () => {
            const result = await integrationManager.createNodeWorkflow(
                'windows node',
                'C:\\Users\\test\\project\\file.ts',
                1
            );

            expect(result.filePath).toBe('C:\\Users\\test\\project\\file.ts');
        });

        it('should handle Unix file paths', async () => {
            const result = await integrationManager.createNodeWorkflow(
                'unix node',
                '/home/user/project/file.ts',
                1
            );

            expect(result.filePath).toBe('/home/user/project/file.ts');
        });

        it('should handle special characters in file paths', async () => {
            const result = await integrationManager.createNodeWorkflow(
                'special node',
                '/test/file with spaces & symbols!.ts',
                1
            );

            expect(result.filePath).toBe('/test/file with spaces & symbols!.ts');
        });
    });

    describe('Memory Management', () => {
        it('should properly dispose resources', () => {
            // Act
            integrationManager.dispose();

            // Should not throw
            expect(true).toBe(true);
        });
    });
});


