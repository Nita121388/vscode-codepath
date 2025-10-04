import * as vscode from 'vscode';
import { ViewFormat } from '../types';

/**
 * Interface for managing VS Code webview panels for preview display
 */
export interface IWebviewManager {
    /**
     * Shows the preview panel with split-screen layout
     */
    showPreview(): Promise<void>;

    /**
     * Hides the preview panel
     */
    hidePreview(): void;

    /**
     * Updates the webview content
     */
    updateContent(content: string, format: ViewFormat): Promise<void>;

    /**
     * Toggles the preview format between text and mermaid
     */
    toggleFormat(): Promise<void>;

    /**
     * Refreshes the preview content
     */
    refreshPreview(): Promise<void>;

    /**
     * Checks if the preview panel is visible
     */
    isVisible(): boolean;

    /**
     * Sets the callback to delete current node
     */
    setDeleteCurrentNodeCallback(callback: () => Promise<void>): void;

    /**
     * Sets the callback to delete current node with children
     */
    setDeleteCurrentNodeWithChildrenCallback(callback: () => Promise<void>): void;

    /**
     * Disposes of webview resources
     */
    dispose(): void;
}

/**
 * Webview panel configuration
 */
export interface WebviewConfig {
    title: string;
    viewType: string;
    showOptions: vscode.ViewColumn;
    enableScripts: boolean;
    retainContextWhenHidden: boolean;
}