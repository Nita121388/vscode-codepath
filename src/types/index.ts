/**
 * Core data model interfaces for CodePath extension
 */

// Re-export error types for convenience
export { CodePathError } from './errors';
export type { ErrorCategory, RecoveryAction } from './errors';

export interface Node {
    id: string;
    name: string;
    filePath: string;
    fileName?: string;
    lineNumber: number;
    codeSnippet?: string;
    codeHash?: string;
    createdAt: Date;
    parentId: string | null;
    childIds: string[];
    validationWarning?: string; // Warning message from location validation
    description?: string; // Optional description for the node
}

export interface Graph {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    nodes: Map<string, Node>;
    rootNodes: string[];
    currentNodeId: string | null;
    // 新增字段以支持节点顺序管理
    nodeOrder?: Map<string, string[]>; // parentId -> ordered childIds
}

export interface GraphMetadata {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    nodeCount: number;
}

export type CustomRootSymbolMode = 'off' | 'override' | 'fallback';
export type CustomRootSymbolSelection = 'fixed' | 'daily';

export interface RootSymbolPreferences {
    enableHolidayThemes: boolean;
    enableSeasonalThemes: boolean;
    customSymbolMode: CustomRootSymbolMode;
    customSymbols: string[];
    customSelectionStrategy: CustomRootSymbolSelection;
}

export interface Configuration {
    defaultView: 'text' | 'mermaid';
    autoSave: boolean;
    autoLoadLastGraph: boolean;
    autoOpenPreviewOnStartup: boolean;
    previewRefreshInterval: number;
    maxNodesPerGraph: number;
    enableBackup: boolean;
    backupInterval: number;
    rootSymbolPreferences: RootSymbolPreferences;
}

export interface StatusBarInfo {
    currentGraph: string | null;
    currentNode: string | null;
    nodeCount: number;
    previewStatus: 'updating' | 'ready' | 'error';
}

export type ViewFormat = 'text' | 'mermaid';

// 新增类型定义
export type ClipboardOperationType = 'copy' | 'cut';
export type NodeMoveDirection = 'up' | 'down';

// 创建节点时的上下文信息
export interface CreationContext {
    name: string;
    filePath: string;
    lineNumber: number;
    source?: 'editor' | 'explorer'; // 标识创建来源
}

// Clipboard-related interfaces
export interface ClipboardData {
    type: ClipboardOperationType;
    nodeTree: NodeTreeData;
    timestamp: number;
    originalNodeId?: string;
}

export interface NodeTreeData {
    node: Node;
    children: NodeTreeData[];
}

// Menu-related interfaces
export interface MenuContext {
    nodeId?: string;
    filePath?: string;
    isFile?: boolean;
    isFolder?: boolean;
}

// Node operation result interfaces
export interface NodeOperationResult {
    success: boolean;
    message: string;
    affectedNodes?: string[];
}

export interface ClipboardOperationResult extends NodeOperationResult {
    clipboardData?: ClipboardData;
}

export interface OrderOperationResult extends NodeOperationResult {
    newPosition?: number;
    moved?: boolean;
}

// Enhanced error handling and user feedback interfaces
export interface UserFeedbackMessage {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    details?: string;
    actionLabel?: string;
    action?: () => void;
    duration?: number; // in milliseconds, 0 for persistent
}

export interface OperationFeedback {
    operation: string;
    success: boolean;
    message: string;
    details?: string;
    suggestedAction?: string;
    debugInfo?: any;
}

// Internationalization support for error messages
export interface LocalizedMessages {
    [key: string]: {
        zh: string;
        en: string;
    };
}

// Debug logging levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    level: LogLevel;
    timestamp: Date;
    component: string;
    operation: string;
    message: string;
    data?: any;
    error?: Error;
}
