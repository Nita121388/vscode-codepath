import { Configuration } from '../types';
import { IConfigurationManager } from '../interfaces/IConfigurationManager';
import { IStorageManager } from '../interfaces/IStorageManager';

/**
 * ConfigurationManager handles configuration schema, validation, loading, and persistence
 * for the CodePath extension settings
 */
export class ConfigurationManager implements IConfigurationManager {
    private currentConfig: Configuration;
    private readonly storageManager: IStorageManager;

    constructor(storageManager: IStorageManager) {
        this.storageManager = storageManager;
        this.currentConfig = this.getDefaultConfiguration();
    }

    /**
     * Gets the default configuration values
     */
    public getDefaultConfiguration(): Configuration {
        return {
            defaultView: 'text',
            autoSave: true,
            autoLoadLastGraph: true,
            previewRefreshInterval: 1000,
            maxNodesPerGraph: 100,
            enableBackup: true,
            backupInterval: 300000 // 5 minutes
        };
    }

    /**
     * Loads configuration from storage
     */
    public async loadConfiguration(): Promise<Configuration> {
        try {
            const config = await this.storageManager.loadConfiguration();
            
            // Validate the loaded configuration
            if (this.validateConfiguration(config)) {
                this.currentConfig = { ...this.getDefaultConfiguration(), ...config };
            } else {
                console.warn('Invalid configuration loaded, using defaults');
                this.currentConfig = this.getDefaultConfiguration();
            }
            
            return this.currentConfig;
        } catch (error) {
            console.warn('Failed to load configuration, using defaults:', error);
            this.currentConfig = this.getDefaultConfiguration();
            return this.currentConfig;
        }
    }

    /**
     * Saves configuration to storage
     */
    public async saveConfiguration(config: Configuration): Promise<void> {
        if (!this.validateConfiguration(config)) {
            throw new Error('Invalid configuration provided');
        }

        try {
            await this.storageManager.saveConfiguration(config);
            this.currentConfig = { ...config };
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error}`);
        }
    }

    /**
     * Gets the current configuration
     */
    public getConfiguration(): Configuration {
        return { ...this.currentConfig };
    }

    /**
     * Updates configuration with partial updates
     */
    public async updateConfiguration(updates: Partial<Configuration>): Promise<void> {
        const newConfig = { ...this.currentConfig, ...updates };
        
        if (!this.validateConfiguration(newConfig)) {
            throw new Error('Invalid configuration updates provided');
        }

        await this.saveConfiguration(newConfig);
    }

    /**
     * Resets configuration to default values
     */
    public async resetToDefaults(): Promise<void> {
        const defaultConfig = this.getDefaultConfiguration();
        await this.saveConfiguration(defaultConfig);
    }

    /**
     * Validates configuration object
     */
    public validateConfiguration(config: Partial<Configuration>): boolean {
        try {
            // Check required properties exist if this is a full configuration
            const isFullConfig = this.isFullConfiguration(config);
            
            if (isFullConfig) {
                const requiredKeys: (keyof Configuration)[] = [
                    'defaultView',
                    'autoSave',
                    'autoLoadLastGraph',
                    'previewRefreshInterval',
                    'maxNodesPerGraph',
                    'enableBackup',
                    'backupInterval'
                ];

                for (const key of requiredKeys) {
                    if (!(key in config)) {
                        console.warn(`Missing required configuration key: ${key}`);
                        return false;
                    }
                }
            }

            // Validate individual properties
            if ('defaultView' in config) {
                if (!this.validateDefaultView(config.defaultView)) {
                    return false;
                }
            }

            if ('autoSave' in config) {
                if (!this.validateBoolean(config.autoSave, 'autoSave')) {
                    return false;
                }
            }

            if ('autoLoadLastGraph' in config) {
                if (!this.validateBoolean(config.autoLoadLastGraph, 'autoLoadLastGraph')) {
                    return false;
                }
            }

            if ('previewRefreshInterval' in config) {
                if (!this.validatePreviewRefreshInterval(config.previewRefreshInterval)) {
                    return false;
                }
            }

            if ('maxNodesPerGraph' in config) {
                if (!this.validateMaxNodesPerGraph(config.maxNodesPerGraph)) {
                    return false;
                }
            }

            if ('enableBackup' in config) {
                if (!this.validateBoolean(config.enableBackup, 'enableBackup')) {
                    return false;
                }
            }

            if ('backupInterval' in config) {
                if (!this.validateBackupInterval(config.backupInterval)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn('Configuration validation error:', error);
            return false;
        }
    }

    /**
     * Checks if the configuration object contains all required properties
     */
    private isFullConfiguration(config: Partial<Configuration>): config is Configuration {
        const requiredKeys: (keyof Configuration)[] = [
            'defaultView',
            'autoSave',
            'autoLoadLastGraph',
            'previewRefreshInterval',
            'maxNodesPerGraph',
            'enableBackup',
            'backupInterval'
        ];

        return requiredKeys.every(key => key in config);
    }

    /**
     * Validates defaultView property
     */
    private validateDefaultView(value: any): value is 'text' | 'mermaid' {
        if (typeof value !== 'string') {
            console.warn('defaultView must be a string');
            return false;
        }

        if (value !== 'text' && value !== 'mermaid') {
            console.warn('defaultView must be either "text" or "mermaid"');
            return false;
        }

        return true;
    }

    /**
     * Validates boolean properties
     */
    private validateBoolean(value: any, propertyName: string): value is boolean {
        if (typeof value !== 'boolean') {
            console.warn(`${propertyName} must be a boolean`);
            return false;
        }
        return true;
    }

    /**
     * Validates previewRefreshInterval property
     */
    private validatePreviewRefreshInterval(value: any): value is number {
        if (typeof value !== 'number') {
            console.warn('previewRefreshInterval must be a number');
            return false;
        }

        if (!Number.isInteger(value)) {
            console.warn('previewRefreshInterval must be an integer');
            return false;
        }

        if (value < 100) {
            console.warn('previewRefreshInterval must be at least 100ms');
            return false;
        }

        if (value > 10000) {
            console.warn('previewRefreshInterval cannot exceed 10000ms');
            return false;
        }

        return true;
    }

    /**
     * Validates maxNodesPerGraph property
     */
    private validateMaxNodesPerGraph(value: any): value is number {
        if (typeof value !== 'number') {
            console.warn('maxNodesPerGraph must be a number');
            return false;
        }

        if (!Number.isInteger(value)) {
            console.warn('maxNodesPerGraph must be an integer');
            return false;
        }

        if (value < 1) {
            console.warn('maxNodesPerGraph must be at least 1');
            return false;
        }

        if (value > 1000) {
            console.warn('maxNodesPerGraph cannot exceed 1000');
            return false;
        }

        return true;
    }

    /**
     * Validates backupInterval property
     */
    private validateBackupInterval(value: any): value is number {
        if (typeof value !== 'number') {
            console.warn('backupInterval must be a number');
            return false;
        }

        if (!Number.isInteger(value)) {
            console.warn('backupInterval must be an integer');
            return false;
        }

        if (value < 60000) { // Minimum 1 minute
            console.warn('backupInterval must be at least 60000ms (1 minute)');
            return false;
        }

        if (value > 3600000) { // Maximum 1 hour
            console.warn('backupInterval cannot exceed 3600000ms (1 hour)');
            return false;
        }

        return true;
    }

    /**
     * Gets configuration value by key with type safety
     */
    public getConfigValue<K extends keyof Configuration>(key: K): Configuration[K] {
        return this.currentConfig[key];
    }

    /**
     * Sets configuration value by key with validation
     */
    public async setConfigValue<K extends keyof Configuration>(
        key: K, 
        value: Configuration[K]
    ): Promise<void> {
        const updates = { [key]: value } as Partial<Configuration>;
        await this.updateConfiguration(updates);
    }

    /**
     * Gets configuration schema for UI generation
     */
    public getConfigurationSchema(): Record<keyof Configuration, any> {
        return {
            defaultView: {
                type: 'enum',
                values: ['text', 'mermaid'],
                default: 'text',
                description: 'Default view format for graph preview'
            },
            autoSave: {
                type: 'boolean',
                default: true,
                description: 'Automatically save graph changes'
            },
            autoLoadLastGraph: {
                type: 'boolean',
                default: true,
                description: 'Automatically load the last used graph on startup'
            },
            previewRefreshInterval: {
                type: 'number',
                min: 100,
                max: 10000,
                default: 1000,
                description: 'Preview refresh interval in milliseconds'
            },
            maxNodesPerGraph: {
                type: 'number',
                min: 1,
                max: 1000,
                default: 100,
                description: 'Maximum number of nodes per graph'
            },
            enableBackup: {
                type: 'boolean',
                default: true,
                description: 'Enable automatic graph backups'
            },
            backupInterval: {
                type: 'number',
                min: 60000,
                max: 3600000,
                default: 300000,
                description: 'Backup interval in milliseconds'
            }
        };
    }

    /**
     * Exports configuration to JSON string
     */
    public exportConfiguration(): string {
        return JSON.stringify(this.currentConfig, null, 2);
    }

    /**
     * Imports configuration from JSON string
     */
    public async importConfiguration(jsonString: string): Promise<void> {
        try {
            const config = JSON.parse(jsonString);
            
            if (!this.validateConfiguration(config)) {
                throw new Error('Invalid configuration format');
            }

            await this.saveConfiguration(config);
        } catch (error) {
            throw new Error(`Failed to import configuration: ${error}`);
        }
    }

    /**
     * Initializes the configuration manager by loading existing configuration
     */
    public async initialize(): Promise<void> {
        await this.loadConfiguration();
    }
}