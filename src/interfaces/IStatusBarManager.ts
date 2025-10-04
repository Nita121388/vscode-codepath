import * as vscode from 'vscode';

/**
 * Interface for managing VS Code status bar integration
 */
export interface IStatusBarManager {
    /**
     * Updates the status bar with current graph information
     */
    updateGraphInfo(graphName: string | null, nodeCount: number): void;

    /**
     * Updates the status bar with current node information
     */
    updateCurrentNode(nodeName: string | null): void;

    /**
     * Updates the preview status indicator
     */
    updatePreviewStatus(status: 'updating' | 'ready' | 'error'): void;

    /**
     * Shows the status bar items
     */
    show(): void;

    /**
     * Hides the status bar items
     */
    hide(): void;

    /**
     * Disposes of status bar resources
     */
    dispose(): void;
}

/**
 * Status bar information structure
 */
export interface StatusBarInfo {
    currentGraph: string | null;
    currentNode: string | null;
    nodeCount: number;
    previewStatus: 'updating' | 'ready' | 'error';
}