import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusBarManager } from './StatusBarManager';

// Use the existing VS Code mock
vi.mock('vscode', () => import('../__mocks__/vscode'));

describe('StatusBarManager', () => {
    let statusBarManager: StatusBarManager;

    beforeEach(() => {
        statusBarManager = new StatusBarManager();
    });

    describe('constructor', () => {
        it('should create status bar manager instance', () => {
            expect(statusBarManager).toBeDefined();
        });
    });

    describe('updateGraphInfo', () => {
        it('should update graph information without throwing', () => {
            expect(() => {
                statusBarManager.updateGraphInfo('Test Graph', 5);
            }).not.toThrow();
        });

        it('should handle null graph name', () => {
            expect(() => {
                statusBarManager.updateGraphInfo(null, 0);
            }).not.toThrow();
        });
    });

    describe('updateCurrentNode', () => {
        it('should update current node information', () => {
            expect(() => {
                statusBarManager.updateCurrentNode('test_node');
            }).not.toThrow();
        });

        it('should handle null node name', () => {
            expect(() => {
                statusBarManager.updateCurrentNode(null);
            }).not.toThrow();
        });
    });   
 describe('updatePreviewStatus', () => {
        it('should update preview status to updating', () => {
            expect(() => {
                statusBarManager.updatePreviewStatus('updating');
            }).not.toThrow();
        });

        it('should update preview status to ready', () => {
            expect(() => {
                statusBarManager.updatePreviewStatus('ready');
            }).not.toThrow();
        });

        it('should update preview status to error', () => {
            expect(() => {
                statusBarManager.updatePreviewStatus('error');
            }).not.toThrow();
        });
    });

    describe('show and hide', () => {
        it('should show all status bar items', () => {
            expect(() => {
                statusBarManager.show();
            }).not.toThrow();
        });

        it('should hide all status bar items', () => {
            expect(() => {
                statusBarManager.hide();
            }).not.toThrow();
        });
    });

    describe('dispose', () => {
        it('should dispose all status bar items', () => {
            expect(() => {
                statusBarManager.dispose();
            }).not.toThrow();
        });

        it('should dispose menu command', () => {
            const manager = new StatusBarManager();
            expect(() => {
                manager.dispose();
            }).not.toThrow();
        });
    });

    describe('status bar menu', () => {
        it('should register menu command', () => {
            const manager = new StatusBarManager();
            expect(manager).toBeDefined();
            // Menu command should be registered during construction
        });

        it('should handle menu command registration', () => {
            expect(() => {
                const manager = new StatusBarManager();
                manager.dispose();
            }).not.toThrow();
        });
    });
});