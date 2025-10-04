import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor } from './PerformanceMonitor';
import { CodePathError } from '../types/errors';

describe('PerformanceMonitor', () => {
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
    });

    describe('constructor', () => {
        it('should create with default configuration', () => {
            const config = performanceMonitor.getConfig();
            
            expect(config.maxNodes).toBe(100);
            expect(config.warningThreshold).toBe(75);
            expect(config.maxRenderTime).toBe(5000);
            expect(config.enableMonitoring).toBe(true);
        });

        it('should create with custom configuration', () => {
            const customMonitor = new PerformanceMonitor({
                maxNodes: 200,
                warningThreshold: 150,
                enableMonitoring: false
            });
            
            const config = customMonitor.getConfig();
            expect(config.maxNodes).toBe(200);
            expect(config.warningThreshold).toBe(150);
            expect(config.enableMonitoring).toBe(false);
        });
    });

    describe('checkNodeLimit', () => {
        it('should allow nodes within limit', () => {
            const result = performanceMonitor.checkNodeLimit(50);
            
            expect(result.allowed).toBe(true);
            expect(result.warning).toBeUndefined();
        });

        it('should warn when approaching limit', () => {
            const result = performanceMonitor.checkNodeLimit(80);
            
            expect(result.allowed).toBe(true);
            expect(result.warning).toContain('approaching the limit');
        });

        it('should reject when exceeding limit', () => {
            const result = performanceMonitor.checkNodeLimit(150);
            
            expect(result.allowed).toBe(false);
            expect(result.warning).toContain('exceeds the maximum limit');
        });

        it('should allow all when monitoring disabled', () => {
            performanceMonitor.setMonitoringEnabled(false);
            const result = performanceMonitor.checkNodeLimit(200);
            
            expect(result.allowed).toBe(true);
            expect(result.warning).toBeUndefined();
        });
    });

    describe('render timing', () => {
        it('should track render time', () => {
            const timerId = performanceMonitor.startRenderTimer();
            expect(timerId).toMatch(/^timer_\d+$/);
            
            // Simulate some delay
            const elapsed = performanceMonitor.endRenderTimer(timerId);
            expect(elapsed).toBeGreaterThanOrEqual(0);
        });

        it('should warn on slow rendering', () => {
            const timerId = performanceMonitor.startRenderTimer();
            
            // Mock a slow render by manipulating the timer
            const timers = (performanceMonitor as any).renderTimers;
            timers.set(timerId, Date.now() - 6000); // 6 seconds ago
            
            performanceMonitor.endRenderTimer(timerId);
            
            const metrics = performanceMonitor.getMetrics();
            expect(metrics.warnings.length).toBeGreaterThan(0);
            expect(metrics.warnings[0]).toContain('6000ms');
        });

        it('should return 0 when monitoring disabled', () => {
            performanceMonitor.setMonitoringEnabled(false);
            const timerId = performanceMonitor.startRenderTimer();
            const elapsed = performanceMonitor.endRenderTimer(timerId);
            
            expect(timerId).toBe('disabled');
            expect(elapsed).toBe(0);
        });
    });

    describe('memory monitoring', () => {
        it('should estimate memory usage', async () => {
            performanceMonitor.checkNodeLimit(50); // Set node count
            const memoryUsage = await performanceMonitor.checkMemoryUsage();
            
            expect(memoryUsage).toBeGreaterThan(0);
            expect(memoryUsage).toBe(50 * 1024); // 1KB per node
        });

        it('should warn on high memory usage', async () => {
            const customMonitor = new PerformanceMonitor({
                maxMemoryUsage: 10 * 1024 // 10KB limit
            });
            
            customMonitor.checkNodeLimit(50); // This will estimate 50KB
            await customMonitor.checkMemoryUsage();
            
            const metrics = customMonitor.getMetrics();
            expect(metrics.warnings.length).toBeGreaterThan(0);
            expect(metrics.warnings[0]).toContain('memory usage');
        });
    });

    describe('performance limits checking', () => {
        it('should return warnings for multiple issues', async () => {
            const warnings = await performanceMonitor.checkPerformanceLimits(150);
            
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]).toContain('exceeds the maximum limit');
        });

        it('should return empty array when monitoring disabled', async () => {
            performanceMonitor.setMonitoringEnabled(false);
            const warnings = await performanceMonitor.checkPerformanceLimits(150);
            
            expect(warnings).toEqual([]);
        });
    });

    describe('operation checking', () => {
        it('should allow normal operations', () => {
            const result = performanceMonitor.shouldAllowOperation('add_node', 50);
            
            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should block adding nodes at limit', () => {
            const result = performanceMonitor.shouldAllowOperation('add_node', 100);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('reached the maximum limit');
            expect(result.suggestedAction).toContain('Remove some nodes');
        });

        it('should block rendering very large graphs', () => {
            const result = performanceMonitor.shouldAllowOperation('render', 200);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('too large to render');
            expect(result.suggestedAction).toContain('simplified view');
        });

        it('should block exporting huge graphs', () => {
            const result = performanceMonitor.shouldAllowOperation('export', 300);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('too large to export');
            expect(result.suggestedAction).toContain('Export in segments');
        });
    });

    describe('recommendations', () => {
        it('should provide recommendations for large graphs', () => {
            performanceMonitor.checkNodeLimit(80);
            const recommendations = performanceMonitor.getRecommendations();
            
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.some(r => r.includes('subgraphs'))).toBe(true);
            expect(recommendations.some(r => r.includes('Remove'))).toBe(true);
        });

        it('should recommend text view for slow rendering', () => {
            const timerId = performanceMonitor.startRenderTimer();
            const timers = (performanceMonitor as any).renderTimers;
            timers.set(timerId, Date.now() - 4500); // 4.5 seconds
            performanceMonitor.endRenderTimer(timerId);
            
            const recommendations = performanceMonitor.getRecommendations();
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.some(r => r.includes('text view'))).toBe(true);
        });

        it('should return empty array when monitoring disabled', () => {
            performanceMonitor.setMonitoringEnabled(false);
            const recommendations = performanceMonitor.getRecommendations();
            
            expect(recommendations).toEqual([]);
        });
    });

    describe('error creation', () => {
        it('should create performance error for blocked operations', () => {
            const error = performanceMonitor.createPerformanceError('add_node', 150);
            
            expect(error).toBeInstanceOf(CodePathError);
            expect(error.category).toBe('performance');
            expect(error.message).toContain('Performance limit exceeded');
        });

        it('should create general performance error for allowed operations', () => {
            const error = performanceMonitor.createPerformanceError('render', 50);
            
            expect(error).toBeInstanceOf(CodePathError);
            expect(error.category).toBe('performance');
            expect(error.userMessage).toContain('may be slow');
        });
    });

    describe('configuration', () => {
        it('should update configuration', () => {
            performanceMonitor.configure({
                maxNodes: 200,
                warningThreshold: 150
            });
            
            const config = performanceMonitor.getConfig();
            expect(config.maxNodes).toBe(200);
            expect(config.warningThreshold).toBe(150);
        });

        it('should enable/disable monitoring', () => {
            performanceMonitor.setMonitoringEnabled(false);
            expect(performanceMonitor.getConfig().enableMonitoring).toBe(false);
            
            performanceMonitor.setMonitoringEnabled(true);
            expect(performanceMonitor.getConfig().enableMonitoring).toBe(true);
        });
    });

    describe('metrics management', () => {
        it('should get current metrics', () => {
            performanceMonitor.checkNodeLimit(50);
            const metrics = performanceMonitor.getMetrics();
            
            expect(metrics.nodeCount).toBe(50);
            expect(metrics.lastUpdate).toBeInstanceOf(Date);
        });

        it('should reset metrics', () => {
            performanceMonitor.checkNodeLimit(50);
            performanceMonitor.resetMetrics();
            
            const metrics = performanceMonitor.getMetrics();
            expect(metrics.nodeCount).toBe(0);
            expect(metrics.warnings).toEqual([]);
        });
    });

    describe('disposal', () => {
        it('should dispose resources', () => {
            const timerId = performanceMonitor.startRenderTimer();
            performanceMonitor.dispose();
            
            const metrics = performanceMonitor.getMetrics();
            expect(metrics.nodeCount).toBe(0);
        });
    });
});