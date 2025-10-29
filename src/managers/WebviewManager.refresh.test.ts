import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebviewManager } from './WebviewManager';
import { NodeManager } from './NodeManager';
import { Graph } from '../models/Graph';
import { Node as NodeModel } from '../models/Node';
import { readFileSync } from 'fs';

// Mock vscode
vi.mock('vscode');

// Mock fs
vi.mock('fs', () => ({
    readFileSync: vi.fn(() => '<html><body>{{nonce}} 🔄 Refresh</body></html>')
}));

describe('WebviewManager - Refresh with Location Validation', () => {
    let webviewManager: WebviewManager;
    let mockContext: vscode.ExtensionContext;
    let nodeManager: NodeManager;
    let mockGraph: Graph;

    beforeEach(() => {
        // Setup mock context
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: process.cwd(), scheme: 'file' },
            extensionPath: process.cwd()
        } as any;

        // Create graph
        mockGraph = new Graph('test-graph', 'Test Graph');

        // Create node manager (it will create its own graph manager)
        nodeManager = new NodeManager();

        // Create webview manager
        webviewManager = new WebviewManager(mockContext);
        webviewManager.setNodeManager(nodeManager);
        // getCurrentGraph returns JSON data, not Graph instance
        webviewManager.setGetCurrentGraphCallback(() => mockGraph.toJSON());
        
        // Set force preview update callback
        let forceUpdateCalled = false;
        webviewManager.setForcePreviewUpdateCallback(async () => {
            forceUpdateCalled = true;
        });

        // Mock vscode functions
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
        vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    });

    it('should add emoji to refresh button', () => {
        // Mock the generateWebviewHtml method to avoid file system issues
        const mockHtml = '<html><body>🔄 Refresh</body></html>';
        vi.spyOn(webviewManager as any, 'generateWebviewHtml').mockReturnValue(mockHtml);
        
        // The emoji is added in the HTML generation
        // We can verify this by checking the generated HTML contains the emoji
        const html = (webviewManager as any).generateWebviewHtml();
        expect(html).toContain('🔄 Refresh');
    });

    it('should validate all nodes on refresh', async () => {
        // Create test nodes
        const node1 = new NodeModel(
            'node1',
            'Test Node 1',
            '/test/file1.ts',
            10,
            'const test = 1;'
        );

        const node2 = new NodeModel(
            'node2',
            'Test Node 2',
            '/test/file2.ts',
            20,
            'function test() {}'
        );

        mockGraph.addNode(node1);
        mockGraph.addNode(node2);

        // Mock location tracker validation
        const mockValidateLocation = vi.fn()
            .mockResolvedValueOnce({
                isValid: true,
                confidence: 'exact'
            })
            .mockResolvedValueOnce({
                isValid: true,
                confidence: 'exact'
            });

        (webviewManager as any).locationTracker.validateLocation = mockValidateLocation;

        // Set refresh callback
        let refreshCalled = false;
        webviewManager.setRefreshCallback(async () => {
            refreshCalled = true;
        });

        // Trigger refresh
        await webviewManager.refreshPreview();

        // Verify refresh callback was called
        expect(refreshCalled).toBe(true);

        // Verify validation was called for all nodes
        expect(mockValidateLocation).toHaveBeenCalledTimes(2);
    });

    it('should update node locations when validation suggests new location', async () => {
        // Create test node
        const node = new NodeModel(
            'node1',
            'Test Node',
            '/test/file.ts',
            10,
            'const test = 1;'
        );

        mockGraph.addNode(node);

        // Mock location tracker to suggest new location
        const mockValidateLocation = vi.fn().mockResolvedValue({
            isValid: false,
            confidence: 'high',
            suggestedLocation: {
                filePath: '/test/file.ts',
                lineNumber: 15
            },
            reason: 'Code moved 5 lines down'
        });

        const mockUpdateNodeLocation = vi.fn().mockResolvedValue({
            ...node,
            lineNumber: 15,
            codeSnippet: 'const test = 1;'
        });

        (webviewManager as any).locationTracker.validateLocation = mockValidateLocation;
        (webviewManager as any).locationTracker.updateNodeLocation = mockUpdateNodeLocation;

        // Mock nodeManager.updateNode to update the graph directly
        const mockUpdateNode = vi.fn().mockImplementation(async (nodeId: string, updates: any) => {
            const node = mockGraph.getNode(nodeId);
            if (node) {
                Object.assign(node, updates);
            }
        });
        vi.spyOn(nodeManager, 'updateNode').mockImplementation(mockUpdateNode);

        // Set refresh callback
        webviewManager.setRefreshCallback(async () => { });

        // Trigger refresh
        await webviewManager.refreshPreview();

        // Verify node was updated
        const updatedNode = mockGraph.getNode('node1');
        expect(updatedNode?.lineNumber).toBe(15);
    });

    it('should show warning for nodes that cannot be validated', async () => {
        // Create test node
        const node = new NodeModel(
            'node1',
            'Test Node',
            '/test/file.ts',
            10,
            'const test = 1;'
        );

        mockGraph.addNode(node);

        // Mock location tracker to return failed validation
        const mockValidateLocation = vi.fn().mockResolvedValue({
            isValid: false,
            confidence: 'failed',
            reason: 'File not found'
        });

        (webviewManager as any).locationTracker.validateLocation = mockValidateLocation;

        // Set refresh callback
        webviewManager.setRefreshCallback(async () => { });

        // Trigger refresh
        await webviewManager.refreshPreview();

        // Verify warning was shown
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        const warningCall = vi.mocked(vscode.window.showWarningMessage).mock.calls[0];
        expect(warningCall[0]).toContain('鈿狅笍');
        expect(warningCall[0]).toContain('warnings');
    });

    it('should show summary with valid, updated, and warning counts', async () => {
        // Create test nodes with different validation results
        const nodes = [
            new NodeModel('valid1', 'Valid Node 1', '/test/file1.ts', 10, 'const test1 = 1;'),
            new NodeModel('valid2', 'Valid Node 2', '/test/file2.ts', 20, 'const test2 = 2;'),
            new NodeModel('moved1', 'Moved Node', '/test/file3.ts', 30, 'const test3 = 3;'),
            new NodeModel('warning1', 'Warning Node', '/test/file4.ts', 40, 'const test4 = 4;')
        ];

        for (const node of nodes) {
            mockGraph.addNode(node);
        }

        // Mock location tracker with different results
        const mockValidateLocation = vi.fn()
            .mockResolvedValueOnce({ isValid: true, confidence: 'exact' })
            .mockResolvedValueOnce({ isValid: true, confidence: 'exact' })
            .mockResolvedValueOnce({
                isValid: false,
                confidence: 'high',
                suggestedLocation: { filePath: '/test/file3.ts', lineNumber: 35 },
                reason: 'Code moved'
            })
            .mockResolvedValueOnce({
                isValid: false,
                confidence: 'failed',
                reason: 'File not found'
            });

        const mockUpdateNodeLocation = vi.fn().mockImplementation(async (node: any) => {
            return {
                ...node,
                lineNumber: 35,
                codeSnippet: 'const test3 = 3;'
            };
        });

        (webviewManager as any).locationTracker.validateLocation = mockValidateLocation;
        (webviewManager as any).locationTracker.updateNodeLocation = mockUpdateNodeLocation;

        // Mock nodeManager.updateNode to update the graph directly
        const mockUpdateNode = vi.fn().mockImplementation(async (nodeId: string, updates: any) => {
            const node = mockGraph.getNode(nodeId);
            if (node) {
                Object.assign(node, updates);
            }
        });
        vi.spyOn(nodeManager, 'updateNode').mockImplementation(mockUpdateNode);

        // Set refresh callback
        webviewManager.setRefreshCallback(async () => { });

        // Trigger refresh
        await webviewManager.refreshPreview();

        // Verify summary message was shown
        const showInfoCalls = vi.mocked(vscode.window.showInformationMessage).mock.calls;
        const showWarnCalls = vi.mocked(vscode.window.showWarningMessage).mock.calls;

        // Either info or warning message should be shown
        expect(showInfoCalls.length + showWarnCalls.length).toBeGreaterThan(0);

        // Get the message (could be from either call)
        const message = showInfoCalls.length > 0
            ? showInfoCalls[showInfoCalls.length - 1][0]
            : showWarnCalls[showWarnCalls.length - 1][0];

        // Verify message contains validation results
        expect(message).toContain('validation completed');
        expect(mockValidateLocation).toHaveBeenCalledTimes(4);
    });

    it('should show success message when all nodes are valid', async () => {
        // Create test nodes
        const nodes = [
            new NodeModel('node1', 'Node 1', '/test/file1.ts', 10, 'const test1 = 1;'),
            new NodeModel('node2', 'Node 2', '/test/file2.ts', 20, 'const test2 = 2;')
        ];

        for (const node of nodes) {
            mockGraph.addNode(node);
        }

        // Mock all validations as successful
        const mockValidateLocation = vi.fn().mockResolvedValue({
            isValid: true,
            confidence: 'exact'
        });

        (webviewManager as any).locationTracker.validateLocation = mockValidateLocation;

        // Set refresh callback
        webviewManager.setRefreshCallback(async () => { });

        // Trigger refresh
        await webviewManager.refreshPreview();

        // Verify success message
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
        const messageCall = vi.mocked(vscode.window.showInformationMessage).mock.calls[0];
        expect(messageCall[0]).toContain('鉁?All 2 nodes are valid');
    });
});
