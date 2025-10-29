// 导入测试框架和VS Code API
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
// 导入扩展模块的主要功能函数
import { activate, deactivate, getExtensionState, resetExtensionState } from './extension';
import { StorageManager } from './managers/StorageManager';
import { ConfigurationManager } from './managers/ConfigurationManager';
import { GraphManager } from './managers/GraphManager';

// 模拟 VS Code API
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }] // 模拟工作区文件夹
    },
    window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined), // 模拟错误消息显示
        showWarningMessage: vi.fn().mockResolvedValue(undefined), // 模拟警告消息显示
        showInformationMessage: vi.fn().mockResolvedValue(undefined) // 模拟信息消息显示
    },
    commands: {
        executeCommand: vi.fn().mockResolvedValue(undefined) // 模拟命令执行
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
        Active: -1,
        Beside: -2
    },
    ExtensionContext: vi.fn(), // 模拟扩展上下文
    Disposable: vi.fn(() => ({ dispose: vi.fn() })) // 模拟可销毁对象
}));

// 模拟各个管理器模块
vi.mock('./managers/StorageManager');
vi.mock('./managers/ConfigurationManager');
vi.mock('./managers/GraphManager');
vi.mock('./managers/NodeManager');
vi.mock('./managers/PreviewManager');
vi.mock('./managers/CommandManager');
vi.mock('./managers/StatusBarManager');
vi.mock('./renderers/TextRenderer');
vi.mock('./renderers/MermaidRenderer');

// 描述扩展生命周期测试
describe('Extension Lifecycle', () => {
    let mockContext: vscode.ExtensionContext;
    let mockStorageManager: any;
    let mockConfigManager: any;
    let mockGraphManager: any;

    // 每个测试用例前执行
    beforeEach(() => {
        // 重置扩展状态
        resetExtensionState();

        // 创建模拟的扩展上下文
        mockContext = {
            subscriptions: [], // 订阅列表
            workspaceState: {
                get: vi.fn(), // 模拟获取工作区状态
                update: vi.fn() // 模拟更新工作区状态
            },
            globalState: {
                get: vi.fn(), // 模拟获取全局状态
                update: vi.fn() // 模拟更新全局状态
            },
            extensionPath: '/test/extension', // 扩展路径
            storagePath: '/test/storage', // 存储路径
            globalStoragePath: '/test/global-storage' // 全局存储路径
        } as any;

        // 设置存储管理器的模拟行为
        mockStorageManager = {
            ensureWorkspaceDirectory: vi.fn().mockResolvedValue(undefined), // 确保工作区目录存在
            loadConfiguration: vi.fn().mockResolvedValue({
                defaultView: 'text', // 默认视图
                autoSave: true, // 自动保存
                autoLoadLastGraph: true, // 自动加载最后图表
                autoOpenPreviewOnStartup: true, // 启动时自动打开预览
                previewRefreshInterval: 1000, // 预览刷新间隔
                maxNodesPerGraph: 100, // 每个图表的最大节点数
                enableBackup: true, // 启用备份
                backupInterval: 300000 // 备份间隔
            }),
            saveConfiguration: vi.fn().mockResolvedValue(undefined) // 保存配置
        };

        // 设置配置管理器的模拟行为
        mockConfigManager = {
            initialize: vi.fn().mockResolvedValue(undefined), // 初始化配置
            getConfiguration: vi.fn().mockReturnValue({
                defaultView: 'text',
                autoSave: true,
                autoLoadLastGraph: true,
                autoOpenPreviewOnStartup: true,
                previewRefreshInterval: 1000,
                maxNodesPerGraph: 100,
                enableBackup: true,
                backupInterval: 300000
            }),
            setupConfigurationWatcher: vi.fn().mockReturnValue({
                dispose: vi.fn()
            }),
            validateConfiguration: vi.fn().mockReturnValue(true),
            updateConfiguration: vi.fn().mockResolvedValue(undefined),
            saveConfiguration: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn()
        };

        // 设置图表管理器的模拟行为
        mockGraphManager = {
            listGraphs: vi.fn().mockResolvedValue([]), // 列出所有图表
            loadGraph: vi.fn().mockResolvedValue({
                id: 'test-graph', // 图表ID
                name: 'Test Graph', // 图表名称
                createdAt: new Date(), // 创建时间
                updatedAt: new Date(), // 更新时间
                nodes: new Map(), // 节点映射
                rootNodes: [], // 根节点列表
                currentNodeId: null // 当前节点ID
            }),
            setCurrentGraph: vi.fn(), // 设置当前图表
            getCurrentGraph: vi.fn().mockReturnValue(null), // 获取当前图表
            saveGraph: vi.fn().mockResolvedValue(undefined) // 保存图表
        };

        // 模拟管理器类的构造函数
        (StorageManager as any).mockImplementation(() => mockStorageManager);
        (ConfigurationManager as any).mockImplementation(() => mockConfigManager);
        (GraphManager as any).mockImplementation(() => mockGraphManager);
    });

    // 每个测试用例后执行
    afterEach(async () => {
        // 停用扩展并清理所有模拟
        await deactivate();
        vi.clearAllMocks();
    });

    // 描述扩展激活测试
    describe('Extension Activation', () => {
        it('应该在有工作区时成功激活', async () => {
            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(true); // 验证扩展已初始化
            expect(state.context).toBe(mockContext); // 验证上下文正确设置
        });

        it('应该优雅处理缺失的工作区', async () => {
            // 模拟没有工作区的情况
            (vscode.workspace as any).workspaceFolders = undefined;

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展未初始化
            // 验证显示警告消息
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('CodePath requires a workspace folder'),
                'Open Folder'
            );
        });

        it('应该设置工作区目录', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // 验证确保工作区目录被调用
            expect(mockStorageManager.ensureWorkspaceDirectory).toHaveBeenCalled();
        });

        it('应该加载配置', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // 验证配置管理器初始化被调用
            expect(mockConfigManager.initialize).toHaveBeenCalled();
        });

        it('当启用时应该自动加载最后图表', async () => {
            // 确保此测试有可用的工作区
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

            // 模拟有图表可加载
            mockGraphManager.listGraphs.mockResolvedValue([
                { id: 'test-graph', name: 'Test Graph', updatedAt: new Date('2024-01-02') }
            ]);
            mockGraphManager.loadGraph.mockResolvedValue(testGraph);

            await activate(mockContext);

            // 验证图表加载流程被正确调用
            expect(mockGraphManager.listGraphs).toHaveBeenCalled();
            expect(mockGraphManager.loadGraph).toHaveBeenCalledWith('test-graph');
            expect(mockGraphManager.setCurrentGraph).toHaveBeenCalledWith(testGraph);
        });

        it('当配置禁用时不应该自动加载', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟配置中禁用了自动加载
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

            // 验证图表列表没有被调用
            expect(mockGraphManager.listGraphs).not.toHaveBeenCalled();
        });

        it('应该优雅处理初始化错误', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟存储管理器初始化失败
            mockStorageManager.ensureWorkspaceDirectory.mockRejectedValue(new Error('Permission denied'));

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展未初始化
            expect(vscode.window.showErrorMessage).toHaveBeenCalled(); // 验证显示错误消息
        });

        it('当图表自动加载时应显示成功消息', async () => {
            // 确保此测试有可用的工作区
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

            // 模拟有图表可加载
            mockGraphManager.listGraphs.mockResolvedValue([
                { id: 'test-graph', name: 'Test Graph', updatedAt: new Date() }
            ]);
            mockGraphManager.loadGraph.mockResolvedValue(testGraph);
            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            await activate(mockContext);

            // 验证显示成功信息消息
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'CodePath: Loaded graph "Test Graph"'
            );
        });
    });

    // 描述扩展停用测试
    describe('Extension Deactivation', () => {
        it('应该成功停用', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);
            await deactivate();

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展未初始化
            expect(state.context).toBeUndefined(); // 验证上下文已清除
        });

        it('当启用自动保存时应保存当前图表', async () => {
            // 确保此测试有可用的工作区
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

            // 模拟有当前图表
            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            await activate(mockContext);
            await deactivate();

            // 验证图表保存被调用
            expect(mockGraphManager.saveGraph).toHaveBeenCalledWith(testGraph);
        });

        it('当禁用自动保存时不应保存', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟配置中禁用了自动保存
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

            // 验证图表保存没有被调用
            expect(mockGraphManager.saveGraph).not.toHaveBeenCalled();
        });

        it('应该优雅处理清理错误', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // 模拟销毁时抛出错误
            const state = getExtensionState();
            state.disposables.push({
                dispose: vi.fn().mockImplementation(() => {
                    throw new Error('Disposal error');
                })
            } as any);

            // 验证停用不会抛出错误
            await expect(deactivate()).resolves.toBeUndefined();
        });

        it('应该销毁所有可销毁对象', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            const mockDisposable = { dispose: vi.fn() }; // 模拟可销毁对象
            state.disposables.push(mockDisposable);

            await deactivate();

            // 验证可销毁对象的dispose方法被调用
            expect(mockDisposable.dispose).toHaveBeenCalled();
            expect(state.disposables).toHaveLength(0); // 验证可销毁对象列表已清空
        });
    });

    // 描述错误处理测试
    describe('Error Handling', () => {
        it('应该处理存储管理器初始化失败', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟存储管理器构造函数抛出错误
            (StorageManager as any).mockImplementation(() => {
                throw new Error('Storage initialization failed');
            });

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展未初始化
            expect(vscode.window.showErrorMessage).toHaveBeenCalled(); // 验证显示错误消息
        });

        it('应该优雅处理配置加载失败', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟配置管理器初始化失败
            mockConfigManager.initialize.mockRejectedValue(new Error('Config load failed'));

            await activate(mockContext);

            // 验证扩展仍然成功初始化
            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
        });

        it('应该优雅处理自动加载失败', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟图表列表加载失败
            mockGraphManager.listGraphs.mockRejectedValue(new Error('Graph list failed'));

            await activate(mockContext);

            // 验证扩展仍然成功初始化
            const state = getExtensionState();
            expect(state.isInitialized).toBe(true);
        });
    });

    // 描述状态管理测试
    describe('State Management', () => {
        it('应该正确维护扩展状态', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            expect(state.isInitialized).toBe(true); // 验证已初始化
            expect(state.context).toBe(mockContext); // 验证上下文
            // 验证所有管理器都已定义
            expect(state.storageManager).toBeDefined();
            expect(state.configManager).toBeDefined();
            expect(state.graphManager).toBeDefined();
            expect(state.nodeManager).toBeDefined();
            expect(state.previewManager).toBeDefined();
            expect(state.commandManager).toBeDefined();
            expect(state.statusBarManager).toBeDefined();
        });

        it('应该正确重置状态', () => {
            const state = getExtensionState();
            state.isInitialized = true;
            state.context = mockContext;

            resetExtensionState();

            const newState = getExtensionState();
            expect(newState.isInitialized).toBe(false); // 验证未初始化
            expect(newState.context).toBeUndefined(); // 验证上下文已清除
            expect(newState.disposables).toHaveLength(0); // 验证可销毁对象列表已清空
        });
    });

    // 描述资源管理测试
    describe('Resource Management', () => {
        it('应该在停用时正确销毁所有管理器', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // 模拟管理器的销毁方法
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

            // 验证所有管理器的销毁方法都被调用
            expect(mockCommandManagerDispose).toHaveBeenCalled();
            expect(mockStatusBarManagerDispose).toHaveBeenCalled();
        });

        it('应该通过清除所有引用来处理内存泄漏', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();
            // 验证管理器已定义
            expect(state.storageManager).toBeDefined();
            expect(state.configManager).toBeDefined();
            expect(state.graphManager).toBeDefined();

            await deactivate();

            const finalState = getExtensionState();
            // 验证所有管理器引用已清除
            expect(finalState.storageManager).toBeUndefined();
            expect(finalState.configManager).toBeUndefined();
            expect(finalState.graphManager).toBeUndefined();
            expect(finalState.nodeManager).toBeUndefined();
            expect(finalState.previewManager).toBeUndefined();
            expect(finalState.commandManager).toBeUndefined();
            expect(finalState.statusBarManager).toBeUndefined();
            expect(finalState.context).toBeUndefined();
        });

        it('应该处理事件监听器清理', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // 添加模拟事件监听器到可销毁对象列表
            const mockEventListener1 = { dispose: vi.fn() };
            const mockEventListener2 = { dispose: vi.fn() };
            const mockEventListener3 = { dispose: vi.fn() };

            state.disposables.push(mockEventListener1, mockEventListener2, mockEventListener3);

            await deactivate();

            // 验证所有事件监听器的dispose方法都被调用
            expect(mockEventListener1.dispose).toHaveBeenCalled();
            expect(mockEventListener2.dispose).toHaveBeenCalled();
            expect(mockEventListener3.dispose).toHaveBeenCalled();

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0); // 验证可销毁对象列表已清空
        });

        it('应该处理有挂起操作时的优雅关闭', async () => {
            // 确保此测试有可用的工作区
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

            // 模拟需要保存的图表
            mockGraphManager.getCurrentGraph.mockReturnValue(testGraph);

            // 模拟慢速保存操作
            let saveResolve: (value: void) => void;
            const savePromise = new Promise<void>((resolve) => {
                saveResolve = resolve;
            });
            mockGraphManager.saveGraph.mockReturnValue(savePromise);

            await activate(mockContext);

            // 开始停用（应该等待保存完成）
            const deactivatePromise = deactivate();

            // 验证保存被调用但停用仍在等待中
            expect(mockGraphManager.saveGraph).toHaveBeenCalledWith(testGraph);

            // 完成保存操作
            saveResolve!();

            // 等待停用完成
            await deactivatePromise;

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展已停用
        });

        it('应该处理销毁错误而不崩溃', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // 添加会抛出错误的可销毁对象
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

            // 尽管有销毁错误，也不应该抛出
            await expect(deactivate()).resolves.toBeUndefined();

            // 所有可销毁对象都应该被尝试销毁
            expect(errorDisposable1.dispose).toHaveBeenCalled();
            expect(errorDisposable2.dispose).toHaveBeenCalled();
            expect(goodDisposable.dispose).toHaveBeenCalled();

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0); // 验证可销毁对象列表已清空
        });

        it('应该优雅处理多次停用调用', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            // 多次调用停用
            await deactivate();
            await deactivate();
            await deactivate();

            // 不应该导致任何问题
            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展已停用
        });

        it('应该处理没有先前激活的停用', async () => {
            // 重置状态以模拟没有激活的情况
            resetExtensionState();

            // 不应该抛出错误
            await expect(deactivate()).resolves.toBeUndefined();

            const state = getExtensionState();
            expect(state.isInitialized).toBe(false); // 验证扩展未初始化
        });
    });

    // 描述性能和内存测试
    describe('Performance and Memory', () => {
        it('在多次激活/停用循环后不应该泄漏内存', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            // 模拟多次激活/停用循环
            for (let i = 0; i < 3; i++) {
                await activate(mockContext);

                const state = getExtensionState();
                expect(state.isInitialized).toBe(true); // 验证扩展已初始化

                await deactivate();

                const finalState = getExtensionState();
                expect(finalState.isInitialized).toBe(false); // 验证扩展已停用
                expect(finalState.disposables).toHaveLength(0); // 验证可销毁对象列表已清空

                // 为下一个循环重置状态
                resetExtensionState();
            }
        });

        it('应该高效处理大量可销毁对象', async () => {
            // 确保此测试有可用的工作区
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

            await activate(mockContext);

            const state = getExtensionState();

            // 添加许多可销毁对象
            const disposables = [];
            for (let i = 0; i < 100; i++) {
                const disposable = { dispose: vi.fn() };
                disposables.push(disposable);
                state.disposables.push(disposable);
            }

            const startTime = Date.now();
            await deactivate();
            const endTime = Date.now();

            // 应该快速完成（少于1秒）
            expect(endTime - startTime).toBeLessThan(1000);

            // 所有可销毁对象的dispose方法都应该被调用
            disposables.forEach(disposable => {
                expect(disposable.dispose).toHaveBeenCalled();
            });

            const finalState = getExtensionState();
            expect(finalState.disposables).toHaveLength(0); // 验证可销毁对象列表已清空
        });
    });
});