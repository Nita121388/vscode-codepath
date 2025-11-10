import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationManager } from './ConfigurationManager';
import { Configuration } from '../types';
import { IStorageManager } from '../interfaces/IStorageManager';

// Mock StorageManager
const mockStorageManager: IStorageManager = {
    saveGraphToFile: vi.fn(),
    loadGraphFromFile: vi.fn(),
    deleteGraphFile: vi.fn(),
    ensureWorkspaceDirectory: vi.fn(),
    workspaceDirectoryExists: vi.fn(),
    getGraphsDirectory: vi.fn(),
    backupGraph: vi.fn(),
    restoreFromBackup: vi.fn(),
    saveConfiguration: vi.fn(),
    loadConfiguration: vi.fn(),
    getCurrentGraphId: vi.fn(),
    listGraphs: vi.fn(),
    exportGraphToMarkdown: vi.fn(),
    isWorkspaceAccessible: vi.fn(),
    getStorageStats: vi.fn(),
    getWorkspaceRootPath: vi.fn(() => '/workspace')
};

describe('ConfigurationManager', () => {
    let configManager: ConfigurationManager;
    const buildConfig = (overrides: Partial<Configuration> = {}): Configuration => {
        const base = configManager.getDefaultConfiguration();
        const baseRoot = base.rootSymbolPreferences;
        const overrideRoot = overrides.rootSymbolPreferences ?? {};

        return {
            ...base,
            ...overrides,
            rootSymbolPreferences: {
                ...baseRoot,
                ...overrideRoot,
                customSymbols: overrideRoot.customSymbols
                    ? [...overrideRoot.customSymbols]
                    : [...baseRoot.customSymbols]
            }
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        configManager = new ConfigurationManager(mockStorageManager);
    });

    describe('getDefaultConfiguration', () => {
        it('should return valid default configuration', () => {
            const defaultConfig = configManager.getDefaultConfiguration();

            expect(defaultConfig.defaultView).toBe('text');
            expect(defaultConfig.autoSave).toBe(true);
            expect(defaultConfig.autoLoadLastGraph).toBe(true);
            expect(defaultConfig.autoOpenPreviewOnStartup).toBe(true);
            expect(defaultConfig.previewRefreshInterval).toBe(1000);
            expect(defaultConfig.maxNodesPerGraph).toBe(100);
            expect(defaultConfig.enableBackup).toBe(true);
            expect(defaultConfig.backupInterval).toBe(300000);
            expect(defaultConfig.aiEndpointAutoStart).toBe(false);
            expect(defaultConfig.aiEndpointPort).toBe(4783);
            expect(defaultConfig.rootSymbolPreferences).toEqual({
                enableHolidayThemes: true,
                enableSeasonalThemes: true,
                customSymbolMode: 'fallback',
                customSymbols: [],
                customSelectionStrategy: 'daily'
            });
        });

        it('should pass validation', () => {
            const defaultConfig = configManager.getDefaultConfiguration();
            expect(configManager.validateConfiguration(defaultConfig)).toBe(true);
        });
    });

    describe('validateConfiguration', () => {
        it('should validate correct full configuration', () => {
            const validConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: false,
                    enableSeasonalThemes: true,
                    customSymbolMode: 'override',
                    customSymbols: ['🪴', '🦊'],
                    customSelectionStrategy: 'daily'
                }
            });

            expect(configManager.validateConfiguration(validConfig)).toBe(true);
        });

        it('should validate partial configuration updates', () => {
            const partialConfig = {
                defaultView: 'mermaid' as const,
                autoSave: false
            };

            expect(configManager.validateConfiguration(partialConfig)).toBe(true);
        });

        it('should reject invalid defaultView', () => {
            const invalidConfig = {
                defaultView: 'invalid' as any
            };

            expect(configManager.validateConfiguration(invalidConfig)).toBe(false);
        });

        it('should reject invalid previewRefreshInterval', () => {
            const invalidConfigs = [
                { previewRefreshInterval: 50 }, // Too low
                { previewRefreshInterval: 15000 }, // Too high
                { previewRefreshInterval: 1.5 }, // Not integer
                { previewRefreshInterval: 'invalid' as any } // Not number
            ];

            for (const config of invalidConfigs) {
                expect(configManager.validateConfiguration(config)).toBe(false);
            }
        });

        it('should reject invalid maxNodesPerGraph', () => {
            const invalidConfigs = [
                { maxNodesPerGraph: 0 }, // Too low
                { maxNodesPerGraph: 1500 }, // Too high
                { maxNodesPerGraph: 1.5 }, // Not integer
                { maxNodesPerGraph: 'invalid' as any } // Not number
            ];

            for (const config of invalidConfigs) {
                expect(configManager.validateConfiguration(config)).toBe(false);
            }
        });

        it('should reject invalid backupInterval', () => {
            const invalidConfigs = [
                { backupInterval: 30000 }, // Too low (less than 1 minute)
                { backupInterval: 4000000 }, // Too high (more than 1 hour)
                { backupInterval: 1.5 }, // Not integer
                { backupInterval: 'invalid' as any } // Not number
            ];

            for (const config of invalidConfigs) {
                expect(configManager.validateConfiguration(config)).toBe(false);
            }
        });

        it('should reject non-boolean values for boolean properties', () => {
            const invalidConfigs = [
                { autoSave: 'true' as any },
                { autoLoadLastGraph: 1 as any },
                { autoOpenPreviewOnStartup: 'yes' as any },
                { enableBackup: null as any },
                { aiEndpointAutoStart: 'yes' as any }
            ];

            for (const config of invalidConfigs) {
                expect(configManager.validateConfiguration(config)).toBe(false);
            }
        });

        it('should reject invalid aiEndpointPort', () => {
            const invalidPorts = [
                { aiEndpointPort: -1 },
                { aiEndpointPort: 70000 },
                { aiEndpointPort: 10.5 },
                { aiEndpointPort: '8080' as any }
            ];

            for (const config of invalidPorts) {
                expect(configManager.validateConfiguration(config)).toBe(false);
            }
        });
    });

    describe('loadConfiguration', () => {
        it('should load valid configuration from storage', async () => {
            const storedConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: true,
                    enableSeasonalThemes: false,
                    customSymbolMode: 'fallback',
                    customSymbols: ['🥳'],
                    customSelectionStrategy: 'fixed'
                }
            });

            vi.mocked(mockStorageManager.loadConfiguration).mockResolvedValue(storedConfig);

            const loadedConfig = await configManager.loadConfiguration();

            expect(loadedConfig).toEqual(storedConfig);
            expect(configManager.getConfiguration()).toEqual(storedConfig);
        });

        it('should use defaults when storage fails', async () => {
            vi.mocked(mockStorageManager.loadConfiguration).mockRejectedValue(new Error('Storage error'));

            const loadedConfig = await configManager.loadConfiguration();
            const defaultConfig = configManager.getDefaultConfiguration();

            expect(loadedConfig).toEqual(defaultConfig);
            expect(configManager.getConfiguration()).toEqual(defaultConfig);
        });

        it('should use defaults when loaded configuration is invalid', async () => {
            const invalidConfig = {
                defaultView: 'invalid',
                autoSave: 'not-boolean'
            };

            vi.mocked(mockStorageManager.loadConfiguration).mockResolvedValue(invalidConfig as any);

            const loadedConfig = await configManager.loadConfiguration();
            const defaultConfig = configManager.getDefaultConfiguration();

            expect(loadedConfig).toEqual(defaultConfig);
        });

        it('should merge partial configuration with defaults', async () => {
            const partialConfig = {
                defaultView: 'mermaid' as const,
                autoSave: false
            };

            vi.mocked(mockStorageManager.loadConfiguration).mockResolvedValue(partialConfig as any);

            const loadedConfig = await configManager.loadConfiguration();
            const defaultConfig = configManager.getDefaultConfiguration();

            expect(loadedConfig).toEqual({
                ...defaultConfig,
                ...partialConfig
            });
        });
    });

    describe('saveConfiguration', () => {
        it('should save valid configuration', async () => {
            const validConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: true,
                    enableSeasonalThemes: true,
                    customSymbolMode: 'override',
                    customSymbols: ['🧊'],
                    customSelectionStrategy: 'fixed'
                }
            });

            await configManager.saveConfiguration(validConfig);

            expect(mockStorageManager.saveConfiguration).toHaveBeenCalledWith(validConfig);
            expect(configManager.getConfiguration()).toEqual(validConfig);
        });

        it('should reject invalid configuration', async () => {
            const invalidConfig = {
                defaultView: 'invalid'
            } as any;

            await expect(configManager.saveConfiguration(invalidConfig))
                .rejects.toThrow('Invalid configuration provided');

            expect(mockStorageManager.saveConfiguration).not.toHaveBeenCalled();
        });

        it('should handle storage errors', async () => {
            const validConfig = configManager.getDefaultConfiguration();
            vi.mocked(mockStorageManager.saveConfiguration).mockRejectedValue(new Error('Storage error'));

            await expect(configManager.saveConfiguration(validConfig))
                .rejects.toThrow('Failed to save configuration');
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration with partial values', async () => {
            vi.mocked(mockStorageManager.saveConfiguration).mockResolvedValue();
            
            const initialConfig = configManager.getDefaultConfiguration();
            const updates = {
                defaultView: 'mermaid' as const,
                autoSave: false
            };

            await configManager.updateConfiguration(updates);

            const expectedConfig = { ...initialConfig, ...updates };
            expect(mockStorageManager.saveConfiguration).toHaveBeenCalledWith(expectedConfig);
            expect(configManager.getConfiguration()).toEqual(expectedConfig);
        });

        it('should reject invalid updates', async () => {
            const invalidUpdates = {
                defaultView: 'invalid'
            };

            await expect(configManager.updateConfiguration(invalidUpdates as any))
                .rejects.toThrow('Invalid configuration updates provided');

            expect(mockStorageManager.saveConfiguration).not.toHaveBeenCalled();
        });
    });

    describe('resetToDefaults', () => {
        it('should reset configuration to defaults', async () => {
            vi.mocked(mockStorageManager.saveConfiguration).mockResolvedValue();
            
            // First set a custom configuration
            const customConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: false,
                    enableSeasonalThemes: true,
                    customSymbolMode: 'override',
                    customSymbols: ['🍡'],
                    customSelectionStrategy: 'daily'
                }
            });

            await configManager.saveConfiguration(customConfig);
            vi.clearAllMocks();

            // Reset to defaults
            await configManager.resetToDefaults();

            const defaultConfig = configManager.getDefaultConfiguration();
            expect(mockStorageManager.saveConfiguration).toHaveBeenCalledWith(defaultConfig);
            expect(configManager.getConfiguration()).toEqual(defaultConfig);
        });
    });

    describe('getConfigValue and setConfigValue', () => {
        it('should get and set individual configuration values', async () => {
            vi.mocked(mockStorageManager.saveConfiguration).mockResolvedValue();
            
            expect(configManager.getConfigValue('defaultView')).toBe('text');

            await configManager.setConfigValue('defaultView', 'mermaid');

            expect(configManager.getConfigValue('defaultView')).toBe('mermaid');
            expect(mockStorageManager.saveConfiguration).toHaveBeenCalled();
        });
    });

    describe('exportConfiguration and importConfiguration', () => {
        it('should export configuration as JSON string', () => {
            const config = configManager.getConfiguration();
            const exported = configManager.exportConfiguration();
            const parsed = JSON.parse(exported);

            expect(parsed).toEqual(config);
        });

        it('should import configuration from JSON string', async () => {
            vi.mocked(mockStorageManager.saveConfiguration).mockResolvedValue();
            
            const customConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: true,
                    enableSeasonalThemes: true,
                    customSymbolMode: 'override',
                    customSymbols: ['🛸'],
                    customSelectionStrategy: 'daily'
                }
            });

            const jsonString = JSON.stringify(customConfig);
            await configManager.importConfiguration(jsonString);

            expect(mockStorageManager.saveConfiguration).toHaveBeenCalledWith(customConfig);
            expect(configManager.getConfiguration()).toEqual(customConfig);
        });

        it('should reject invalid JSON during import', async () => {
            const invalidJson = '{ invalid json }';

            await expect(configManager.importConfiguration(invalidJson))
                .rejects.toThrow('Failed to import configuration');

            expect(mockStorageManager.saveConfiguration).not.toHaveBeenCalled();
        });

        it('should reject invalid configuration during import', async () => {
            const invalidConfig = { defaultView: 'invalid' };
            const jsonString = JSON.stringify(invalidConfig);

            await expect(configManager.importConfiguration(jsonString))
                .rejects.toThrow('Failed to import configuration');

            expect(mockStorageManager.saveConfiguration).not.toHaveBeenCalled();
        });
    });

    describe('getConfigurationSchema', () => {
        it('should return configuration schema', () => {
            const schema = configManager.getConfigurationSchema();

            expect(schema.defaultView.type).toBe('enum');
            expect(schema.defaultView.values).toEqual(['text', 'mermaid']);
            expect(schema.autoSave.type).toBe('boolean');
            expect(schema.previewRefreshInterval.type).toBe('number');
            expect(schema.previewRefreshInterval.min).toBe(100);
            expect(schema.previewRefreshInterval.max).toBe(10000);
            expect(schema.defaultView.hidden).toBe(true);
            expect(schema.rootSymbolPreferences.type).toBe('object');
            expect(schema.rootSymbolPreferences.properties.customSymbolMode.values)
                .toEqual(['off', 'override', 'fallback']);
            expect(schema.rootSymbolPreferences.properties.customSymbols.type).toBe('array');
            expect(schema.rootSymbolPreferences.hidden).toBe(true);
        });
    });

    describe('initialize', () => {
        it('should initialize by loading configuration', async () => {
            const storedConfig = buildConfig({
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: true,
                    enableSeasonalThemes: false,
                    customSymbolMode: 'fallback',
                    customSymbols: ['🧠'],
                    customSelectionStrategy: 'fixed'
                }
            });

            vi.mocked(mockStorageManager.loadConfiguration).mockResolvedValue(storedConfig);

            await configManager.initialize();

            expect(mockStorageManager.loadConfiguration).toHaveBeenCalled();
            expect(configManager.getConfiguration()).toEqual(storedConfig);
        });
    });
});
