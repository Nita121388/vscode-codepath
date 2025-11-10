// 测试工具函数和通用 mock 配置
import { vi } from 'vitest';

/**
 * 创建一个基本的 mock 对象，包含常用的方法
 */
export function createBasicMock(methods: string[] = []): any {
    const mock: any = {};
    methods.forEach(method => {
        mock[method] = vi.fn();
    });
    return mock;
}

/**
 * 创建 IntegrationManager 的 mock
 */
export function createMockIntegrationManager(): any {
    return {
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
        getNodeManager: vi.fn(),
        dispose: vi.fn()
    };
}

/**
 * 创建 NodeManager 的 mock
 */
export function createMockNodeManager(): any {
    return {
        getCurrentNode: vi.fn(() => null),
        createNode: vi.fn(() => ({
            id: 'mock-node-id',
            name: 'Mock Node',
            filePath: '/mock/path',
            lineNumber: 1,
            parentId: null,
            childIds: []
        })),
        updateNode: vi.fn(() => Promise.resolve()),
        deleteNode: vi.fn(() => Promise.resolve()),
        deleteNodeWithChildren: vi.fn(() => Promise.resolve()),
        getNode: vi.fn(() => null),
        validateAllNodes: vi.fn(() => Promise.resolve()),
        createChildNode: vi.fn(() => ({
            id: 'mock-child-node-id',
            name: 'Mock Child Node',
            filePath: '/mock/path',
            lineNumber: 1,
            parentId: 'mock-parent-id',
            childIds: []
        })),
        createParentNode: vi.fn(() => ({
            id: 'mock-parent-node-id',
            name: 'Mock Parent Node',
            filePath: '/mock/path',
            lineNumber: 1,
            parentId: null,
            childIds: ['mock-child-id']
        })),
        createBroNode: vi.fn(() => ({
            id: 'mock-bro-node-id',
            name: 'Mock Bro Node',
            filePath: '/mock/path',
            lineNumber: 1,
            parentId: null,
            childIds: []
        })),
        setCurrentNode: vi.fn()
    };
}

/**
 * 创建 GraphManager 的 mock
 */
export function createMockGraphManager(): any {
    return {
        getCurrentGraph: vi.fn(() => null),
        createGraph: vi.fn(() => ({ 
            id: 'mock-graph-id', 
            name: 'Mock Graph', 
            nodes: new Map(),
            rootNodes: [],
            currentNodeId: null 
        })),
        loadGraph: vi.fn(() => Promise.resolve()),
        saveGraph: vi.fn(() => Promise.resolve()),
        deleteGraph: vi.fn(() => Promise.resolve()),
        listGraphs: vi.fn(() => Promise.resolve([])),
        exportGraph: vi.fn(() => Promise.resolve('mock export')),
        importGraph: vi.fn(() => Promise.resolve())
    };
}

/**
 * 创建 WebviewManager 的 mock
 */
export function createMockWebviewManager(): any {
    return {
        showPreview: vi.fn(),
        updateContent: vi.fn(),
        updatePreview: vi.fn(),
        forceUpdate: vi.fn(),
        dispose: vi.fn(),
        setNodeSwitchCallback: vi.fn(),
        setFormatToggleCallback: vi.fn(),
        setRefreshCallback: vi.fn(),
        setGetNodeByLocationCallback: vi.fn(),
        setNodeManager: vi.fn(),
        setGetCurrentGraphCallback: vi.fn(),
        setForcePreviewUpdateCallback: vi.fn(),
        setDeleteCurrentNodeCallback: vi.fn(),
        setDeleteCurrentNodeWithChildrenCallback: vi.fn(),
        setExportGraphCallback: vi.fn(),
        setUpdateCurrentNodeCallback: vi.fn(),
        isVisible: vi.fn(() => false)
    };
}

/**
 * 创建 PreviewManager 的 mock
 */
export function createMockPreviewManager(): any {
    return {
        updatePreview: vi.fn(),
        forceUpdate: vi.fn(),
        onUpdate: vi.fn((callback: (content: string, format: string) => void) => {
            // 模拟注册回调函数
            return { dispose: vi.fn() };
        }),
        onError: vi.fn((callback: (error: Error) => void) => {
            // 模拟注册错误回调函数
            return { dispose: vi.fn() };
        }),
        getFormat: vi.fn(() => 'text'),
        setFormat: vi.fn(),
        dispose: vi.fn(),
        toggleFormat: vi.fn(() => 'mermaid'),
        setGraph: vi.fn(),
        getStatus: vi.fn(() => ({ isUpdating: false }))
    };
}

/**
 * 创建 PerformanceMonitor 的 mock
 */
export function createMockPerformanceMonitor(): any {
    return {
        startOperation: vi.fn(() => ({ id: 'test-operation', startTime: Date.now() })),
        endOperation: vi.fn(),
        getMemoryStats: vi.fn(() => ({
            heapUsed: 1024 * 1024,
            heapTotal: 2048 * 1024,
            external: 512 * 1024
        })),
        getMetrics: vi.fn(() => ({
            memoryUsage: {
                heapUsed: 1024 * 1024,
                heapTotal: 2048 * 1024,
                external: 512 * 1024
            },
            operationCount: 5,
            averageOperationTime: 100
        })),
        dispose: vi.fn()
    };
}

/**
 * 创建 FeedbackManager 的 mock
 */
export function createMockFeedbackManager(): any {
    return {
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn(),
        dispose: vi.fn()
    };
}

/**
 * 创建 StatusBarManager 的 mock
 */
export function createMockStatusBarManager(): any {
    return {
        updateStatus: vi.fn(),
        dispose: vi.fn(),
        updateGraphInfo: vi.fn(),
        showMessage: vi.fn(),
        hide: vi.fn(),
        updateCurrentNode: vi.fn(),
        updatePreviewStatus: vi.fn(),
        show: vi.fn()
    };
}

/**
 * 创建 ConfigurationManager 的 mock
 */
export function createMockConfigurationManager(): any {
    return {
        getConfiguration: vi.fn(() => ({
            maxNodesPerGraph: 1000,
            autoSave: true,
            defaultViewFormat: 'text'
        })),
        updateConfiguration: vi.fn(() => Promise.resolve()),
        saveConfiguration: vi.fn(() => Promise.resolve()),
        initialize: vi.fn(() => Promise.resolve()),
        setupConfigurationWatcher: vi.fn(() => ({
            dispose: vi.fn()
        })),
        validateConfiguration: vi.fn(() => true),
        getDefaultConfiguration: vi.fn(() => ({
            maxNodesPerGraph: 1000,
            autoSave: true,
            defaultViewFormat: 'text'
        })),
        dispose: vi.fn()
    };
}

/**
 * 创建 StorageManager 的 mock
 */
export function createMockStorageManager(): any {
    return {
        saveGraph: vi.fn(() => Promise.resolve()),
        loadGraph: vi.fn(() => Promise.resolve(null)),
        deleteGraph: vi.fn(() => Promise.resolve()),
        listGraphs: vi.fn(() => Promise.resolve([])),
        exportGraph: vi.fn(() => Promise.resolve('exported content')),
        importGraph: vi.fn(() => Promise.resolve({ id: 'imported', name: 'Imported Graph' })),
        ensureDirectories: vi.fn(() => Promise.resolve()),
        ensureWorkspaceDirectory: vi.fn(() => Promise.resolve()),
        workspaceDirectoryExists: vi.fn(() => Promise.resolve(true)),
        dispose: vi.fn()
    };
}

/**
 * 创建一个基本的 Graph mock
 */
export function createMockGraph(): any {
    return {
        id: 'test-graph',
        name: 'Test Graph',
        nodes: new Map(),
        rootNodes: [],
        currentNodeId: null,
        addNode: vi.fn(),
        removeNode: vi.fn(),
        getNode: vi.fn(),
        clear: vi.fn(),
        toJSON: vi.fn(() => ({
            id: 'test-graph',
            name: 'Test Graph',
            nodes: [],
            rootNodes: [],
            currentNodeId: null
        }))
    };
}

/**
 * 创建一个基本的 Node mock
 */
export function createMockNode(id: string = 'test-node', name: string = 'Test Node'): any {
    return {
        id,
        name,
        filePath: '/test/file.ts',
        lineNumber: 1,
        parentId: null,
        childIds: [],
        createdAt: new Date(),
        toJSON: vi.fn(() => ({
            id,
            name,
            filePath: '/test/file.ts',
            lineNumber: 1,
            parentId: null,
            childIds: []
        }))
    };
}

/**
 * 设置常用的 VS Code API mocks
 */
export function setupVSCodeMocks(): void {
    // 这个函数可以用来设置一些通用的 VS Code API mocks
    // 目前我们使用 __mocks__/vscode.ts，所以这里暂时为空
}
