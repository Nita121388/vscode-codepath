import * as vscode from 'vscode';
import { Configuration, RootSymbolPreferences } from '../types';
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
            autoOpenPreviewOnStartup: true,
            previewRefreshInterval: 1000,
            maxNodesPerGraph: 100,
            enableBackup: true,
            backupInterval: 300000, // 5 minutes
            rootSymbolPreferences: this.getDefaultRootSymbolPreferences(),
            aiEndpointAutoStart: false,
            aiEndpointPort: 4783
        };
    }

    /**
     * 获取根节点符号的默认配置
     */
    private getDefaultRootSymbolPreferences(): RootSymbolPreferences {
        return {
            enableHolidayThemes: true,
            enableSeasonalThemes: true,
            customSymbolMode: 'fallback' as const,
            customSymbols: [],
            customSelectionStrategy: 'daily' as const
        };
    }

    /**
     * 从VS Code工作区配置中读取设置
     */
    private loadVSCodeConfiguration(): Partial<Configuration> {
        const config = vscode.workspace.getConfiguration('codepath');

        // 只读取已定义的配置项，避免undefined值覆盖默认值
        const vscodeConfig: Partial<Configuration> = {};

        const autoSave = config.get<boolean>('autoSave');
        if (autoSave !== undefined) {
            vscodeConfig.autoSave = autoSave;
        }

        const autoLoadLastGraph = config.get<boolean>('autoLoadLastGraph');
        if (autoLoadLastGraph !== undefined) {
            vscodeConfig.autoLoadLastGraph = autoLoadLastGraph;
        }

        const autoOpenPreviewOnStartup = config.get<boolean>('autoOpenPreviewOnStartup');
        if (autoOpenPreviewOnStartup !== undefined) {
            vscodeConfig.autoOpenPreviewOnStartup = autoOpenPreviewOnStartup;
        }

        const previewRefreshInterval = config.get<number>('previewRefreshInterval');
        if (previewRefreshInterval !== undefined) {
            vscodeConfig.previewRefreshInterval = previewRefreshInterval;
        }

        const maxNodesPerGraph = config.get<number>('maxNodesPerGraph');
        if (maxNodesPerGraph !== undefined) {
            vscodeConfig.maxNodesPerGraph = maxNodesPerGraph;
        }

        const aiEndpointAutoStart = config.get<boolean>('aiEndpointAutoStart');
        if (aiEndpointAutoStart !== undefined) {
            vscodeConfig.aiEndpointAutoStart = aiEndpointAutoStart;
        }

        const aiEndpointPort = config.get<number>('aiEndpointPort');
        if (aiEndpointPort !== undefined) {
            vscodeConfig.aiEndpointPort = aiEndpointPort;
        }

        return vscodeConfig;
    }

    /**
     * Loads configuration from storage
     */
    public async loadConfiguration(): Promise<Configuration> {
        try {
            // 1. 读取VS Code配置（优先级最高）
            const vscodeConfig = this.loadVSCodeConfiguration();

            // 2. 读取本地存储配置
            const localConfig = await this.storageManager.loadConfiguration();

            // 3. 合并配置：VS Code配置 > 本地配置 > 默认配置
            const mergedConfig = {
                ...localConfig,
                ...vscodeConfig  // VS Code配置覆盖本地配置
            };

            // 4. 验证配置
            if (this.validateConfiguration(mergedConfig)) {
                this.currentConfig = this.mergeWithDefaults(mergedConfig as Partial<Configuration>);
            } else {
                console.warn('Invalid merged configuration, using defaults');
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
            const configToPersist = this.cloneConfiguration(config);
            await this.storageManager.saveConfiguration(configToPersist);
            this.currentConfig = configToPersist;
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error}`);
        }
    }

    /**
     * Gets the current configuration
     */
    public getConfiguration(): Configuration {
        return this.cloneConfiguration(this.currentConfig);
    }

    /**
     * Updates configuration with partial updates
     */
    public async updateConfiguration(updates: Partial<Configuration>): Promise<void> {
        const newConfig = this.mergeConfigurations(this.currentConfig, updates);
        
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
     * 合并配置并保留嵌套对象的默认值
     */
    private mergeConfigurations(
        base: Configuration,
        updates: Partial<Configuration>
    ): Configuration {
        const merged: Configuration = {
            ...base,
            ...updates
        };

        merged.rootSymbolPreferences = this.mergeRootSymbolPreferences(
            base.rootSymbolPreferences,
            updates.rootSymbolPreferences
        );

        return this.cloneConfiguration(merged);
    }

    /**
     * 与默认配置进行合并，填充缺省字段
     */
    private mergeWithDefaults(config: Partial<Configuration>): Configuration {
        const defaults = this.getDefaultConfiguration();

        const merged: Configuration = {
            ...defaults,
            ...config
        };

        merged.rootSymbolPreferences = this.mergeRootSymbolPreferences(
            defaults.rootSymbolPreferences,
            config.rootSymbolPreferences
        );

        return this.cloneConfiguration(merged);
    }

    /**
     * 深拷贝配置，避免外部修改内部状态
     */
    private cloneConfiguration(config: Configuration): Configuration {
        return {
            ...config,
            rootSymbolPreferences: this.cloneRootSymbolPreferences(config.rootSymbolPreferences)
        };
    }

    /**
     * 深拷贝根节点符号配置
     */
    private cloneRootSymbolPreferences(preferences: RootSymbolPreferences): RootSymbolPreferences {
        return {
            ...preferences,
            customSymbols: [...preferences.customSymbols]
        };
    }

    /**
     * 合并根节点符号配置
     */
    private mergeRootSymbolPreferences(
        base: RootSymbolPreferences,
        overrides?: Partial<RootSymbolPreferences>
    ): RootSymbolPreferences {
        if (!overrides) {
            return this.cloneRootSymbolPreferences(base);
        }

        const merged: RootSymbolPreferences = {
            ...base,
            ...overrides
        };

        if (overrides.customSymbols) {
            merged.customSymbols = overrides.customSymbols
                .map(symbol => (typeof symbol === 'string' ? symbol.trim() : ''))
                .filter(symbol => symbol.length > 0);
        } else {
            merged.customSymbols = [...base.customSymbols];
        }

        return merged;
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
                'backupInterval',
                'rootSymbolPreferences',
                'aiEndpointAutoStart',
                'aiEndpointPort'
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

            if ('autoOpenPreviewOnStartup' in config) {
                if (!this.validateBoolean(config.autoOpenPreviewOnStartup, 'autoOpenPreviewOnStartup')) {
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

            if ('rootSymbolPreferences' in config) {
                if (!this.validateRootSymbolPreferences(
                    config.rootSymbolPreferences,
                    isFullConfig
                )) {
                    return false;
                }
            }

            if ('aiEndpointAutoStart' in config) {
                if (!this.validateBoolean(config.aiEndpointAutoStart, 'aiEndpointAutoStart')) {
                    return false;
                }
            }

            if ('aiEndpointPort' in config) {
                if (!this.validateAiEndpointPort(config.aiEndpointPort)) {
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
            'backupInterval',
            'rootSymbolPreferences',
            'aiEndpointAutoStart',
            'aiEndpointPort'
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
     * Validates AI endpoint port property
     */
    private validateAiEndpointPort(value: any): value is number {
        if (typeof value !== 'number') {
            console.warn('aiEndpointPort must be a number');
            return false;
        }

        if (!Number.isInteger(value)) {
            console.warn('aiEndpointPort must be an integer');
            return false;
        }

        if (value < 0 || value > 65535) {
            console.warn('aiEndpointPort must be between 0 and 65535');
            return false;
        }

        return true;
    }

    /**
     * 校验根节点符号配置
     */
    private validateRootSymbolPreferences(
        value: any,
        requireAllFields: boolean
    ): value is RootSymbolPreferences | Partial<RootSymbolPreferences> {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            console.warn('rootSymbolPreferences 必须是对象');
            return false;
        }

        const requiredFields: (keyof RootSymbolPreferences)[] = [
            'enableHolidayThemes',
            'enableSeasonalThemes',
            'customSymbolMode',
            'customSymbols',
            'customSelectionStrategy'
        ];

        if (requireAllFields) {
            for (const field of requiredFields) {
                if (!(field in value)) {
                    console.warn(`rootSymbolPreferences 缺少必要字段: ${field}`);
                    return false;
                }
            }
        }

        if ('enableHolidayThemes' in value && typeof value.enableHolidayThemes !== 'boolean') {
            console.warn('rootSymbolPreferences.enableHolidayThemes 必须是布尔值');
            return false;
        }

        if ('enableSeasonalThemes' in value && typeof value.enableSeasonalThemes !== 'boolean') {
            console.warn('rootSymbolPreferences.enableSeasonalThemes 必须是布尔值');
            return false;
        }

        if ('customSymbolMode' in value) {
            if (typeof value.customSymbolMode !== 'string') {
                console.warn('rootSymbolPreferences.customSymbolMode 必须是字符串');
                return false;
            }

            const allowedModes: RootSymbolPreferences['customSymbolMode'][] = ['off', 'override', 'fallback'];
            if (!allowedModes.includes(value.customSymbolMode)) {
                console.warn('rootSymbolPreferences.customSymbolMode 取值必须为 off | override | fallback');
                return false;
            }
        }

        if ('customSelectionStrategy' in value) {
            if (typeof value.customSelectionStrategy !== 'string') {
                console.warn('rootSymbolPreferences.customSelectionStrategy 必须是字符串');
                return false;
            }

            const allowedStrategies: RootSymbolPreferences['customSelectionStrategy'][] = ['fixed', 'daily'];
            if (!allowedStrategies.includes(value.customSelectionStrategy)) {
                console.warn('rootSymbolPreferences.customSelectionStrategy 取值必须为 fixed | daily');
                return false;
            }
        }

        if ('customSymbols' in value) {
            if (!Array.isArray(value.customSymbols)) {
                console.warn('rootSymbolPreferences.customSymbols 必须是字符串数组');
                return false;
            }

            for (const symbol of value.customSymbols) {
                if (typeof symbol !== 'string') {
                    console.warn('rootSymbolPreferences.customSymbols 中的元素必须是字符串');
                    return false;
                }

                if (symbol.trim().length === 0) {
                    console.warn('rootSymbolPreferences.customSymbols 中的字符串不能为空');
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Gets configuration value by key with type safety
     */
    public getConfigValue<K extends keyof Configuration>(key: K): Configuration[K] {
        if (key === 'rootSymbolPreferences') {
            return this.cloneRootSymbolPreferences(this.currentConfig.rootSymbolPreferences) as Configuration[K];
        }

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
                description: 'Default view format for graph preview',
                hidden: true // 暂不对用户暴露
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
            autoOpenPreviewOnStartup: {
                type: 'boolean',
                default: true,
                description: '打开 IDE 时自动展开 CodePath 预览面板'
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
            },
            aiEndpointAutoStart: {
                type: 'boolean',
                default: false,
                description: '自动在扩展激活时启动 AI 通信端口'
            },
            aiEndpointPort: {
                type: 'number',
                min: 0,
                max: 65535,
                default: 4783,
                description: 'AI 通信端口监听的本地端口号（0 表示随机端口）'
            },
            rootSymbolPreferences: {
                type: 'object',
                description: '根节点符号的节日主题与自定义表情设置',
                hidden: true,
                properties: {
                    enableHolidayThemes: {
                        type: 'boolean',
                        default: true,
                        description: '节日（如圣诞、万圣节等）是否自动切换符号'
                    },
                    enableSeasonalThemes: {
                        type: 'boolean',
                        default: true,
                        description: '是否根据季度切换根节点符号'
                    },
                    customSymbolMode: {
                        type: 'enum',
                        values: ['off', 'override', 'fallback'],
                        default: 'fallback',
                        description: '自定义表情池的使用策略：关闭、完全覆盖或作为兜底'
                    },
                    customSelectionStrategy: {
                        type: 'enum',
                        values: ['fixed', 'daily'],
                        default: 'daily',
                        description: '自定义表情池的选择策略：固定使用第一项或按日轮换'
                    },
                    customSymbols: {
                        type: 'array',
                        itemType: 'string',
                        default: [],
                        description: '自定义的根节点表情或图标列表'
                    }
                }
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

    /**
     * 设置VS Code配置变化监听器
     */
    public setupConfigurationWatcher(): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('codepath')) {
                console.log('CodePath configuration changed, reloading...');
                try {
                    await this.loadConfiguration();
                    console.log('Configuration reloaded successfully');
                } catch (error) {
                    console.error('Failed to reload configuration:', error);
                }
            }
        });
    }
}
