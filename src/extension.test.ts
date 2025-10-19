import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate, getExtensionState, resetExtensionState } from './extension';
import { StorageManager } from './managers/StorageManager';
import { ConfigurationManager } from './managers/ConfigurationManager';
import { GraphManager } from './managers/GraphManager';

// Mock VS Code API
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
    },
    window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showWarningMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
    },
    commands: {
        executeCommand: vi.fn().mockResolvedValue(undefined)
    },
    ExtensionContext: vi.fn(),
    Disposable: vi.fn(() => ({ dispose: vi.fn() }))
}));

// Mock managers
vi.mock('./managers/StorageManager');
vi.mock('./managers/ConfigurationManager');
vi.mock('./managers/GraphManager');
vi.mock('./managers/NodeManager');
vi.mock('./managers/PreviewManager');
vi.mock('./managers/CommandManager');
vi.mock('./managers/StatusBarManager');
vi.mock('./renderers/TextRenderer');
vi.mock('./renderers/MermaidRenderer');

describe('Extension Lifecycle', () => {
    let mockContext: vscode.ExtensionContext;
    let mockStorageManager: any;
    let mockConfigManager: any;
    let mockGraphManager: any;

    beforeEach(() => {
        resetExtensionState();

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
            globalStoragePath: '/test/global-storage'
        } as any;

        // Setup mocks
        mockStorageManager = {
            ensureWorkspaceDirectory: vi.fn().mockResolvedValue(undefined),
            loadConfiguration: vi.fn().mockResolvedValue({
                defaultView: 'text',
                autoSave: true,
                autoLoadLastGraph: true,
                autoOpenPreviewOnStartup: true,
                previewRefreshInterval: 1000,
                maxNodesPerGraph: 100,
                enableBackup: true,
                backupInterval: 300000
            }),
            saveConfiguration: vi.fn().mockResolvedValue(undefined)
        };

        mockConfigManager = {
            initialize: vi.fn().mockResolvedValue(undefined),
            getConfiguration: vi.fn().mockReturnValue({
                defaultView: 'text',
                autoSave: true,
                autoLoadLastGraph: true,
                autoOpenPreviewOnStartup: true,
                previewRefreshInterval: 1000,
                maxNodesPerGraph: 100,
                enableBackup: true,
                backupInterval: 300000
            })
        };

        mockGraphManager = {
            listGraphs: vi.fn().mockResolvedValue([]),
            loadGraph: vi.fn().mockResolvedValue({
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            }),
            setCurrentGraph: vi.fn(),
            getCurrentGraph: vi.fn().mockReturnValue(null),
            saveGraph: vi.fn().mockResolvedValue(undefined)
        };

        // Mock constructors
        (StorageManager as any).mockImplementation(() => mockStorageManager);
        (ConfigurationManager as any).mockImplementation(() => mockConfigManager);
        (GraphManager as any).mockImplementation(() => mockGraphManager);
    });

    afterEach(async () => {
        await deactivate();
        vi.clearAllMocks();
    });

    describe('Extension Activation', () => {
        it('should activate successfully with workspace', async () => {
            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
            expect(state.context).toBe(mockContext);
        });

        it('should handle missing workspace gracefully', async () => {
            // Mock no workspace
            (vscode.workspace as any).workspaceFolders = undefined;

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('CodePath requires a workspace folder'),
                'Open Folder'
            );
        });

        it('should setup workspace directory', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            expect(mockStorageManager.ensureWorkspaceDirectory).toHaveBeenCalled();
        });

        it('should load configuration', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            expect(mockConfigManager.initialize).toHaveBeenCalled();
        });

        it('should auto-load last graph when enabled', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            const testGraph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            mockGraphManager.listGraphs.mockResolvedValue([
                { id: 'test-graph', name: 'Test Graph', updatedAt: new Date('2024-01-02') }
            ]);
            mockGraphManager.loadGraph.mockResolvedValue(testGraph);

            await activate(mockContext);

            expect(mockGraphManager.listGraphs).toHaveBeenCalled();
            expect(mockGraphManager.loadGraph).toHaveBeenCalledWith('test-graph');
            expect(mockGraphManager.setCurrentGraph).toHaveBeenCalledWith(testGraph);
        });

        it('should not auto-load when disabled in config', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            mockConfigManager.getConfiguration.mockReturnValue({
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: true,
                autoSave: true,
                defaultView: 'text',
                previewRefreshInterval: 1000,
                maxNodesPerGraph: 100,
                enableBackup: true,
                backupInterval: 300000
            });

            await activate(mockContext);

            expect(mockGraphManager.listGraphs).not.toHaveBeenCalled();
        });

        it('should handle initialization errors gracefully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            mockStorageManager.ensureWorkspaceDirectory.mockRejectedValue(new Error('Permission denied'));

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should show success message when graph is auto-loaded', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            const testGraph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            mockGraphManager.listGraphs.mockResolvedValue([
                { id: 'test-graph', name: 'Test Graph', updatedAt: new Date() }
            ]);
            mockGraphManager.loadGraph.mockResolvedValue(testGraph);
            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            await activate(mockContext);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'CodePath: Loaded graph "Test Graph"'
            );
        });
    });

    describe('Extension Deactivation', () => {
        it('should deactivate successfully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);
            await deactivate();

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
            expect(state.context).toBeUndefined();
        });

        it('should save current graph when auto-save is enabled', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            const testGraph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            await activate(mockContext);
            await deactivate();

            expect(mockGraphManager.saveGraph).toHaveBeenCalledWith(testGraph);
        });

        it('should not save when auto-save is disabled', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            mockConfigManager.getConfiguration.mockReturnValue({
                autoSave: false,
                autoLoadLastGraph: true,
                autoOpenPreviewOnStartup: true,
                defaultView: 'text',
                previewRefreshInterval: 1000,
                maxNodesPerGraph: 100,
                enableBackup: true,
                backupInterval: 300000
            });

            await activate(mockContext);
            await deactivate();

            expect(mockGraphManager.saveGraph).not.toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // Mock disposal error
            const state = getExtensionState();
            state.disposables.push({
                dispose: vi.fn().mockImplementation(() => {
                    throw new Error('Disposal error');
                })
            } as any);

            // Should not throw
            await expect(deactivate()).resolves.toBeUndefined();
        });

        it('should dispose all disposables', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            const mockDisposable = { dispose: vi.fn() };
            state.disposables.push(mockDisposable);

            await deactivate();

            expect(mockDisposable.dispose).toHaveBeenCalled();
            expect(state.disposables).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle storage manager initialization failure', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            (StorageManager as any).mockImplementation(() => {
                throw new Error('Storage initialization failed');
            });

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle configuration loading failure gracefully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            mockConfigManager.initialize.mockRejectedValue(new Error('Config load failed'));

            await activate(mockContext);

            // Should still initialize successfully
            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
        });

        it('should handle auto-load failure gracefully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            mockGraphManager.listGraphs.mockRejectedValue(new Error('Graph list failed'));

            await activate(mockContext);

            // Should still initialize successfully
            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
        });
    });

    describe('State Management', () => {
        it('should maintain extension state correctly', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
            expect(state.context).toBe(mockContext);
            expect(state.storageManager).toBeDefined();
            expect(state.configManager).toBeDefined();
            expect(state.graphManager).toBeDefined();
            expect(state.nodeManager).toBeDefined();
            expect(state.previewManager).toBeDefined();
            expect(state.commandManager).toBeDefined();
            expect(state.statusBarManager).toBeDefined();
        });

        it('should reset state correctly', () => {
            const state = getExtensionState();
            state.isInitialized = true;
            state.context = mockContext;

            resetExtensionState();

            const newState = getExtensionState();
            expect(newState.isInitialized).toBe(false);
            expect(newState.context).toBeUndefined();
            expect(newState.disposables).toHaveLength(0);
        });
    });

    describe('Resource Management', () => {
        it('should properly dispose of all managers on deactivation', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // Mock dispose methods on managers
            const mockCommandManagerDispose = vi.fn();
            const mockStatusBarManagerDispose = vi.fn();
            const mockPreviewManagerDispose = vi.fn();

            if (state.commandManager) {
                (state.commandManager as any).dispose = mockCommandManagerDispose;
            }
            if (state.statusBarManager) {
                (state.statusBarManager as any).dispose = mockStatusBarManagerDispose;
            }
            if (state.previewManager) {
                (state.previewManager as any).dispose = mockPreviewManagerDispose;
            }

            await deactivate();

            // Verify managers are disposed
            expect(mockCommandManagerDispose).toHaveBeenCalled();
            expect(mockStatusBarManagerDispose).toHaveBeenCalled();
        });

        it('should handle memory leaks by clearing all references', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.storageManager).toBeDefined();
            expect(state.configManager).toBeDefined();
            expect(state.graphManager).toBeDefined();

            await deactivate();

            const finalState = getExtensionState();
            expect(finalState.storageManager).toBeUndefined();
            expect(finalState.configManager).toBeUndefined();
            expect(finalState.graphManager).toBeUndefined();
            expect(finalState.nodeManager).toBeUndefined();
            expect(finalState.previewManager).toBeUndefined();
            expect(finalState.commandManager).toBeUndefined();
            expect(finalState.statusBarManager).toBeUndefined();
            expect(finalState.context).toBeUndefined();
        });

        it('should handle event listener cleanup', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // Add mock event listeners to disposables
            const mockEventListener1 = { dispose: vi.fn() };
            const mockEventListener2 = { dispose: vi.fn() };
            const mockEventListener3 = { dispose: vi.fn() };

            state.disposables.push(mockEventListener1, mockEventListener2, mockEventListener3);

            await deactivate();

            expect(mockEventListener1.dispose).toHaveBeenCalled();
            expect(mockEventListener2.dispose).toHaveBeenCalled();
            expect(mockEventListener3.dispose).toHaveBeenCalled();

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0);
        });

        it('should handle graceful shutdown with pending operations', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            const testGraph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            // Mock a graph that needs saving
            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            // Mock a slow save operation
            let saveResolve: (value: void) => void;
            const savePromise = new Promise<void>((resolve) => {
                saveResolve = resolve;
            });
            mockGraphManager.saveGraph.mockReturnValue(savePromise);

            await activate(mockContext);

            // Start deactivation (which should wait for save)
            const deactivatePromise = deactivate();

            // Verify save was called but deactivation is still pending
            expect(mockGraphManager.saveGraph).toHaveBeenCalledWith(testGraph);

            // Complete the save operation
            saveResolve!();

            // Wait for deactivation to complete
            await deactivatePromise;

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
        });

        it('should handle disposal errors without crashing', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // Add disposables that will throw errors
            const errorDisposable1 = {
                dispose: vi.fn().mockImplementation(() => {
                    throw new Error('Disposal error 1');
                })
            };
            const errorDisposable2 = {
                dispose: vi.fn().mockImplementation(() => {
                    throw new Error('Disposal error 2');
                })
            };
            const goodDisposable = { dispose: vi.fn() };

            state.disposables.push(errorDisposable1, errorDisposable2, goodDisposable);

            // Should not throw despite disposal errors
            await expect(deactivate()).resolves.toBeUndefined();

            // All disposables should have been attempted
            expect(errorDisposable1.dispose).toHaveBeenCalled();
            expect(errorDisposable2.dispose).toHaveBeenCalled();
            expect(goodDisposable.dispose).toHaveBeenCalled();

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0);
        });

        it('should handle multiple deactivation calls gracefully', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // Call deactivate multiple times
            await deactivate();
            await deactivate();
            await deactivate();

            // Should not cause any issues
            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
        });

        it('should handle deactivation without prior activation', async () => {
            // Reset state to simulate no activation
            resetExtensionState();

            // Should not throw
            await expect(deactivate()).resolves.toBeUndefined();

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false);
        });
    });

    describe('Performance and Memory', () => {
        it('should not leak memory after multiple activation/deactivation cycles', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // Simulate multiple activation/deactivation cycles
            for (let i = 0; i < 3; i++) {
                await activate(mockContext);

                const state = getExtensionState();
                expect(state.isInitialized).toBe(true);

                await deactivate();

                const finalState = getExtensionState();
                expect(finalState.isInitialized).toBe(false);
                expect(finalState.disposables).toHaveLength(0);

                // Reset for next cycle
                resetExtensionState();
            }
        });

        it('should handle large numbers of disposables efficiently', async () => {
            // Ensure workspace is available for this test
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // Add many disposables
            const disposables = [];
            for (let i = 0; i < 100; i++) {
                const disposable = { dispose: vi.fn() };
                disposables.push(disposable);
                state.disposables.push(disposable);
            }

            const startTime = Date.now();
            await deactivate();
            const endTime = Date.now();

            // Should complete quickly (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000);

            // All disposables should be called
            disposables.forEach(disposable => {
                expect(disposable.dispose).toHaveBeenCalled();
            });

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0);
        });
    });
});
