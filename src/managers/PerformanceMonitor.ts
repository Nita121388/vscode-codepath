import { IPerformanceMonitor, PerformanceConfig, PerformanceMetrics } from '../interfaces/IPerformanceMonitor';
import { CodePathError } from '../types/errors';

/**
 * Performance monitor for tracking and limiting resource usage
 */
export class PerformanceMonitor implements IPerformanceMonitor {
    private config: PerformanceConfig;
    private metrics: PerformanceMetrics;
    private renderTimers: Map<string, number>;
    private timerIdCounter: number;

    constructor(config?: Partial<PerformanceConfig>) {
        this.config = {
            maxNodes: 100,
            warningThreshold: 75,
            maxRenderTime: 5000, // 5 seconds
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            enableMonitoring: true,
            ...config
        };

        this.metrics = {
            nodeCount: 0,
            renderTime: 0,
            memoryUsage: 0,
            lastUpdate: new Date(),
            warnings: []
        };

        this.renderTimers = new Map();
        this.timerIdCounter = 0;
    }

    /**
     * Check if the current graph size is within limits
     */
    checkNodeLimit(nodeCount: number): { allowed: boolean; warning?: string } {
        if (!this.config.enableMonitoring) {
            return { allowed: true };
        }

        this.metrics.nodeCount = nodeCount;
        this.metrics.lastUpdate = new Date();

        if (nodeCount > this.config.maxNodes) {
            const warning = `Graph has ${nodeCount} nodes, which exceeds the maximum limit of ${this.config.maxNodes}`;
            this.metrics.warnings.push(warning);
            return { 
                allowed: false, 
                warning 
            };
        }

        if (nodeCount > this.config.warningThreshold) {
            const warning = `Graph has ${nodeCount} nodes, approaching the limit of ${this.config.maxNodes}`;
            this.metrics.warnings.push(warning);
            return { 
                allowed: true, 
                warning 
            };
        }

        return { allowed: true };
    }

    /**
     * Monitor rendering performance
     */
    startRenderTimer(): string {
        if (!this.config.enableMonitoring) {
            return 'disabled';
        }

        const timerId = `timer_${++this.timerIdCounter}`;
        this.renderTimers.set(timerId, Date.now());
        return timerId;
    }

    /**
     * End render timer and return elapsed time
     */
    endRenderTimer(timerId: string): number {
        if (!this.config.enableMonitoring || timerId === 'disabled') {
            return 0;
        }

        const startTime = this.renderTimers.get(timerId);
        if (!startTime) {
            return 0;
        }

        const elapsed = Date.now() - startTime;
        this.renderTimers.delete(timerId);

        this.metrics.renderTime = elapsed;
        this.metrics.lastUpdate = new Date();

        if (elapsed > this.config.maxRenderTime) {
            const warning = `Rendering took ${elapsed}ms, which exceeds the limit of ${this.config.maxRenderTime}ms`;
            this.metrics.warnings.push(warning);
        }

        return elapsed;
    }

    /**
     * Check memory usage (simplified implementation)
     */
    async checkMemoryUsage(): Promise<number> {
        if (!this.config.enableMonitoring) {
            return 0;
        }

        // In a real implementation, this would check actual memory usage
        // For now, we'll estimate based on node count and other factors
        const estimatedMemory = this.metrics.nodeCount * 1024; // 1KB per node estimate
        
        this.metrics.memoryUsage = estimatedMemory;
        this.metrics.lastUpdate = new Date();

        if (estimatedMemory > this.config.maxMemoryUsage) {
            const warning = `Estimated memory usage ${Math.round(estimatedMemory / 1024)}KB exceeds limit of ${Math.round(this.config.maxMemoryUsage / 1024)}KB`;
            this.metrics.warnings.push(warning);
        }

        return estimatedMemory;
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Check if performance limits are exceeded
     */
    async checkPerformanceLimits(nodeCount: number): Promise<string[]> {
        const warnings: string[] = [];

        if (!this.config.enableMonitoring) {
            return warnings;
        }

        // Check node count limits
        const nodeCheck = this.checkNodeLimit(nodeCount);
        if (nodeCheck.warning) {
            warnings.push(nodeCheck.warning);
        }

        // Check memory usage
        await this.checkMemoryUsage();
        
        // Return all accumulated warnings
        const allWarnings = [...warnings, ...this.metrics.warnings];
        
        // Clear warnings after returning them
        this.metrics.warnings = [];
        
        return allWarnings;
    }

    /**
     * Reset performance metrics
     */
    resetMetrics(): void {
        this.metrics = {
            nodeCount: 0,
            renderTime: 0,
            memoryUsage: 0,
            lastUpdate: new Date(),
            warnings: []
        };
        
        this.renderTimers.clear();
    }

    /**
     * Configure performance limits
     */
    configure(config: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): PerformanceConfig {
        return { ...this.config };
    }

    /**
     * Enable or disable monitoring
     */
    setMonitoringEnabled(enabled: boolean): void {
        this.config.enableMonitoring = enabled;
        if (!enabled) {
            this.resetMetrics();
        }
    }

    /**
     * Check if a graph operation should be allowed based on performance
     */
    shouldAllowOperation(operationType: 'render' | 'add_node' | 'export', nodeCount: number): { 
        allowed: boolean; 
        reason?: string; 
        suggestedAction?: string 
    } {
        if (!this.config.enableMonitoring) {
            return { allowed: true };
        }

        switch (operationType) {
            case 'add_node':
                if (nodeCount >= this.config.maxNodes) {
                    return {
                        allowed: false,
                        reason: `Cannot add more nodes. Graph has reached the maximum limit of ${this.config.maxNodes} nodes.`,
                        suggestedAction: 'Remove some nodes or increase the limit in settings'
                    };
                }
                break;

            case 'render':
                if (nodeCount > this.config.maxNodes * 1.5) {
                    return {
                        allowed: false,
                        reason: `Graph is too large to render safely (${nodeCount} nodes).`,
                        suggestedAction: 'Use simplified view or reduce the number of nodes'
                    };
                }
                break;

            case 'export':
                if (nodeCount > this.config.maxNodes * 2) {
                    return {
                        allowed: false,
                        reason: `Graph is too large to export (${nodeCount} nodes).`,
                        suggestedAction: 'Export in segments or reduce the number of nodes'
                    };
                }
                break;
        }

        return { allowed: true };
    }

    /**
     * Get performance recommendations based on current metrics
     */
    getRecommendations(): string[] {
        const recommendations: string[] = [];

        if (!this.config.enableMonitoring) {
            return recommendations;
        }

        if (this.metrics.nodeCount > this.config.warningThreshold) {
            recommendations.push('Consider organizing your graph into smaller, focused subgraphs');
            recommendations.push('Remove unused or outdated nodes to improve performance');
        }

        if (this.metrics.renderTime > this.config.maxRenderTime * 0.8) {
            recommendations.push('Use text view for better performance with large graphs');
            recommendations.push('Consider using simplified Mermaid view for complex graphs');
        }

        if (this.metrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
            recommendations.push('Close other VS Code extensions to free up memory');
            recommendations.push('Restart VS Code to clear memory usage');
        }

        return recommendations;
    }

    /**
     * Create a performance error based on current state
     */
    createPerformanceError(operation: string, nodeCount: number): CodePathError {
        const check = this.shouldAllowOperation(operation as any, nodeCount);
        
        if (!check.allowed && check.reason) {
            return CodePathError.performanceError(
                `Performance limit exceeded for ${operation}`,
                check.reason
            );
        }

        return CodePathError.performanceError(
            `Performance issue detected during ${operation}`,
            `Operation may be slow with ${nodeCount} nodes`
        );
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.renderTimers.clear();
        this.resetMetrics();
    }
}