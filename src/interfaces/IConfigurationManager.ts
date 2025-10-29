import * as vscode from 'vscode';
import { Configuration } from '../types';

export interface IConfigurationManager {
    loadConfiguration(): Promise<Configuration>;
    saveConfiguration(config: Configuration): Promise<void>;
    getConfiguration(): Configuration;
    updateConfiguration(updates: Partial<Configuration>): Promise<void>;
    resetToDefaults(): Promise<void>;
    validateConfiguration(config: Partial<Configuration>): boolean;
    getDefaultConfiguration(): Configuration;
    setupConfigurationWatcher(): vscode.Disposable;
}