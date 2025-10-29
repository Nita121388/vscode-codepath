/**
 * @fileoverview Main extension entry point for CodePath VS Code extension
 * 
 * This file contains the activation and deactivation logic for the CodePath extension,
 * which helps developers visualize and track code execution paths through interactive
 * node-based graphs.
 * 
 * 扩展的核心入口文件，负责初始化各类管理器、注册命令，并在停用时释放资源，支撑代码路径预览能力。
 * 
 * @author CodePath Team
 * @version 0.1.0
 * @since 2025-10-01
 */

import * as vscode from 'vscode';
import { GraphManager } from './managers/GraphManager';
import { NodeManager } from './managers/NodeManager';
import { PreviewManager } from './managers/PreviewManager';
import { StorageManager } from './managers/StorageManager';
import { ConfigurationManager } from './managers/ConfigurationManager';
import { CommandManager } from './managers/CommandManager';
import { StatusBarManager } from './managers/StatusBarManager';
import { WebviewManager } from './managers/WebviewManager';
import { IntegrationManager } from './managers/IntegrationManager';
import { PreviewSidebarProvider } from './views/PreviewSidebarProvider';
import { RootSymbolService } from './services/RootSymbolService';
import { CodePathError } from './types/errors';

/**
 * Global extension state interface
 * 
 * Maintains references to all managers and extension state to ensure proper
 * lifecycle management and resource cleanup.
 */
interface ExtensionState {
    /** Configuration manager for handling VS Code settings */
    configManager?: ConfigurationManager;
    /** Storage manager for file system operations */
    storageManager?: StorageManager;
    /** Graph manager for graph lifecycle operations */
    graphManager?: GraphManager;
    /** Node manager for node creation and relationships */
    nodeManager?: NodeManager;
    /** Preview manager for rendering and display */
    previewManager?: PreviewManager;
    /** Webview manager for preview panel management */
    webviewManager?: WebviewManager;
    /** Integration manager for coordinating all components */
    integrationManager?: IntegrationManager;
    /** Command manager for VS Code command registration */
    commandManager?: CommandManager;
    /** Status bar manager for status bar integration */
    statusBarManager?: StatusBarManager;
    /** VS Code extension context */
    context?: vscode.ExtensionContext;
    /** Flag indicating if extension is fully initialized */
    isInitialized: boolean;
    /** Array of disposables for cleanup */
    disposables: vscode.Disposable[];
}

let extensionState: ExtensionState = {
    isInitialized: false,
    disposables: []
};

/**
 * Main extension activation function
 * 
 * This function is called when the extension is activated by VS Code. It initializes
 * all managers, sets up the workspace, loads configuration, and registers commands.
 * 
 * 扩展被唤醒时的统一启动流程，串联配置加载、工作区检测、视图注册等步骤，确保各组件处于就绪状态。
 * 
 * @param context - VS Code extension context providing access to extension lifecycle
 * @returns Promise that resolves when activation is complete
 * 
 * @example
 * ```typescript
 * // Called automatically by VS Code when extension activates
 * await activate(context);
 * ```
 * 
 * @throws {Error} When workspace is not available or initialization fails
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('CodePath extension activation started');

    try {
        // Store context for cleanup
        extensionState.context = context;

        // Check workspace availability
        if (!await checkWorkspaceAvailability()) {
            return;
        }

        // Initialize core managers
        await initializeManagers(context);

        // Setup workspace directory
        await setupWorkspaceDirectory();

        // Load configuration
        await loadConfiguration();

        // Auto-load last graph if enabled
        // 根据用户配置自动恢复上次的图数据，提高扩展启动后的工作连续性
        await autoLoadLastGraph();

        // Register commands and UI components
        registerViewProviders(context);
        registerCommands(context);
        setupStatusBar();

        // Mark as initialized
        extensionState.isInitialized = true;

        console.log('CodePath extension initialized successfully');
        
        // Show initialization success message (optional)
        const config = extensionState.configManager?.getConfiguration();
        if (config?.autoLoadLastGraph) {
            const currentGraph = extensionState.graphManager?.getCurrentGraph();
            if (currentGraph) {
                vscode.window.showInformationMessage(`CodePath: Loaded graph "${currentGraph.name}"`);
            }
        }

    } catch (error) {
        console.error('Failed to initialize CodePath extension:', error);
        
        if (error instanceof CodePathError) {
            vscode.window.showErrorMessage(`CodePath: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('CodePath: Failed to initialize extension');
        }
        
        // Cleanup on failure
        await cleanup();
    }
}

/**
 * Checks if a workspace is available and shows appropriate messages
 */
async function checkWorkspaceAvailability(): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        console.log('CodePath: No workspace folder detected, extension will be limited');
        const result = vscode.window.showWarningMessage(
            'CodePath requires a workspace folder to function properly. Please open a folder or workspace.',
            'Open Folder'
        );
        
        // Handle the result if it's a thenable
        if (result && typeof result.then === 'function') {
            result.then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
            });
        }
        
        return false;
    }

    return true;
}

/**
 * Initializes all core managers
 */
async function initializeManagers(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Initialize storage manager first
        extensionState.storageManager = new StorageManager();
        
        // Initialize configuration manager with storage
        extensionState.configManager = new ConfigurationManager(extensionState.storageManager);

        // Setup configuration watcher for runtime config changes
        const configWatcher = extensionState.configManager.setupConfigurationWatcher();
        extensionState.disposables.push(configWatcher);

        // Initialize graph manager
        extensionState.graphManager = new GraphManager(extensionState.storageManager);
        
        // Initialize node manager
        extensionState.nodeManager = new NodeManager(extensionState.graphManager);
        
        // Initialize preview manager
        const defaultFormat = extensionState.configManager.getConfiguration().defaultView;
        const rootSymbolService = new RootSymbolService({
            configProvider: () => extensionState.configManager?.getConfiguration()
        });
        // 初始化根节点符号服务，支持节日/季节主题与用户自定义
        extensionState.previewManager = new PreviewManager(defaultFormat, 300, rootSymbolService);
        
        // Initialize webview manager
        extensionState.webviewManager = new WebviewManager(context);

        // Initialize status bar manager
        extensionState.statusBarManager = new StatusBarManager();

        // Initialize integration manager to coordinate all components
        extensionState.integrationManager = new IntegrationManager(
            extensionState.graphManager,
            extensionState.nodeManager,
            extensionState.previewManager,
            extensionState.webviewManager,
            extensionState.statusBarManager,
            extensionState.configManager,
            context
        );

        console.log('CodePath: Core managers initialized');
    } catch (error) {
        throw CodePathError.filesystemError(
            `Failed to initialize managers: ${error}`
        );
    }
}

/**
 * Sets up the workspace directory structure
 */
async function setupWorkspaceDirectory(): Promise<void> {
    try {
        if (!extensionState.storageManager) {
            throw new Error('StorageManager not initialized');
        }

        await extensionState.storageManager.ensureWorkspaceDirectory();
        console.log('CodePath: Workspace directory setup completed');
    } catch (error) {
        throw CodePathError.filesystemError(
            `Failed to setup workspace directory: ${error}`
        );
    }
}

/**
 * Loads configuration from storage
 */
async function loadConfiguration(): Promise<void> {
    try {
        if (!extensionState.configManager) {
            throw new Error('ConfigurationManager not initialized');
        }

        await extensionState.configManager.initialize();
        console.log('CodePath: Configuration loaded');
    } catch (error) {
        console.warn('CodePath: Failed to load configuration, using defaults:', error);
        // This is not a fatal error, we can continue with defaults
    }
}

/**
 * Auto-loads the last used graph if enabled in configuration
 */
async function autoLoadLastGraph(): Promise<void> {
    try {
        if (!extensionState.configManager || !extensionState.graphManager) {
            return;
        }

        const config = extensionState.configManager.getConfiguration();
        if (!config.autoLoadLastGraph) {
            console.log('CodePath: Auto-load last graph is disabled');
            return;
        }

        // Try to load the last used graph
        const graphs = await extensionState.graphManager.listGraphs();
        if (graphs.length === 0) {
            console.log('CodePath: No graphs found to auto-load');
            return;
        }

        // Sort by last updated and load the most recent
        const sortedGraphs = graphs.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        const lastGraph = await extensionState.graphManager.loadGraph(sortedGraphs[0].id);
        extensionState.graphManager.setCurrentGraph(lastGraph);
        
        console.log(`CodePath: Auto-loaded graph "${lastGraph.name}"`);

        // Update status bar and VS Code context
        if (extensionState.statusBarManager) {
            extensionState.statusBarManager.updateGraphInfo(
                lastGraph.name,
                lastGraph.nodes.size
            );
            
            // Update VS Code context for conditional menu items
            vscode.commands.executeCommand('setContext', 'codepath.hasCurrentGraph', true);
        }

        // Auto-open preview panel if graph has nodes
        if (lastGraph.nodes.size > 0 && extensionState.integrationManager) {
            // 更新预览内容，确保后续用户手动打开时能立即看到最新状态
            await extensionState.integrationManager.updatePreview();

            if (config.autoOpenPreviewOnStartup) {
                // Then show the preview panel
                await extensionState.integrationManager.showPreview();
                console.log('CodePath: Auto-opened preview panel with graph content');
            }
        }
    } catch (error) {
        console.warn('CodePath: Failed to auto-load last graph:', error);
        // This is not a fatal error, we can continue without a loaded graph
    }
}


/**
 * 注册所有侧边栏视图提供者
 */
function registerViewProviders(context: vscode.ExtensionContext): void {
    if (!extensionState.webviewManager) {
        throw new Error('WebviewManager not initialized');
    }

    try {
        const sidebarProvider = new PreviewSidebarProvider(extensionState.webviewManager);
        const registration = vscode.window.registerWebviewViewProvider(
            PreviewSidebarProvider.viewId,
            sidebarProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );

        extensionState.disposables.push(registration);
    } catch (error) {
        console.error('CodePath: Failed to register sidebar preview view:', error);
        vscode.window.showWarningMessage('CodePath: 无法初始化侧边栏预览视图');
    }
}

/**
 * Registers all commands with VS Code
 */
function registerCommands(context: vscode.ExtensionContext): void {
    try {
        if (!extensionState.graphManager || !extensionState.nodeManager || !extensionState.previewManager) {
            throw new Error('Required managers not initialized');
        }

        // Initialize command manager and register commands
        extensionState.commandManager = new CommandManager(
            extensionState.graphManager,
            extensionState.nodeManager,
            extensionState.integrationManager!
        );
        
        extensionState.commandManager.registerCommands(context);
        
        // Add command manager to disposables
        extensionState.disposables.push(extensionState.commandManager);
        
        console.log('CodePath: Commands registered');
    } catch (error) {
        throw CodePathError.userError(
            `Failed to register commands: ${error}`
        );
    }
}

/**
 * Sets up the status bar
 */
function setupStatusBar(): void {
    try {
        if (!extensionState.statusBarManager) {
            throw new Error('StatusBarManager not initialized');
        }

        extensionState.statusBarManager.show();
        extensionState.disposables.push(extensionState.statusBarManager);
        
        console.log('CodePath: Status bar setup completed');
    } catch (error) {
        console.warn('CodePath: Failed to setup status bar:', error);
        // This is not a fatal error
    }
}

/**
 * This function is called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
    console.log('CodePath extension deactivation started');
    await cleanup();
    console.log('CodePath extension deactivated successfully');
}

/**
 * Performs cleanup of all resources
 *
 * 在扩展停用或异常时，统一保存状态并释放所有可释放资源，防止残留引用影响下次激活。
 */
async function cleanup(): Promise<void> {
    try {
        // Save current state if auto-save is enabled
        await saveCurrentState();

        // Dispose of all disposables
        for (const disposable of extensionState.disposables) {
            // 逐一调用 dispose，容错处理防止单个资源释放失败影响整体流程
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('Error disposing resource:', error);
            }
        }
        extensionState.disposables = [];

        // Clear managers
        extensionState.commandManager = undefined;
        extensionState.integrationManager = undefined;
        extensionState.statusBarManager = undefined;
        extensionState.webviewManager = undefined;
        extensionState.previewManager = undefined;
        extensionState.nodeManager = undefined;
        extensionState.graphManager = undefined;
        extensionState.configManager = undefined;
        extensionState.storageManager = undefined;
        extensionState.context = undefined;
        extensionState.isInitialized = false;

        console.log('CodePath: Cleanup completed');
    } catch (error) {
        console.error('CodePath: Error during cleanup:', error);
    }
}

/**
 * Saves current state before deactivation
 */
async function saveCurrentState(): Promise<void> {
    try {
        if (!extensionState.isInitialized || !extensionState.configManager || !extensionState.graphManager) {
            return;
        }

        const config = extensionState.configManager.getConfiguration();
        if (!config.autoSave) {
            return;
        }

        const currentGraph = extensionState.graphManager.getCurrentGraph();
        if (currentGraph) {
            await extensionState.graphManager.saveGraph(currentGraph);
            console.log('CodePath: Current graph saved before deactivation');
        }
    } catch (error) {
        console.warn('CodePath: Failed to save current state:', error);
    }
}

/**
 * Gets the current extension state (for testing)
 */
export function getExtensionState(): ExtensionState {
    return extensionState;
}

/**
 * Resets the extension state (for testing)
 */
export function resetExtensionState(): void {
    extensionState = {
        isInitialized: false,
        disposables: []
    };
}
