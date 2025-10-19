import { describe, it, expect } from 'vitest';
import { RootSymbolService } from './RootSymbolService';
import { Configuration, RootSymbolPreferences } from '../types';

const buildPreferences = (overrides: Partial<RootSymbolPreferences> = {}): RootSymbolPreferences => ({
    enableHolidayThemes: overrides.enableHolidayThemes ?? true,
    enableSeasonalThemes: overrides.enableSeasonalThemes ?? true,
    customSymbolMode: overrides.customSymbolMode ?? 'fallback',
    customSymbols: overrides.customSymbols ? [...overrides.customSymbols] : [],
    customSelectionStrategy: overrides.customSelectionStrategy ?? 'daily'
});

const buildConfig = (preferences: Partial<RootSymbolPreferences> = {}): Configuration => ({
    defaultView: 'text',
    autoSave: true,
    autoLoadLastGraph: true,
    previewRefreshInterval: 1000,
    maxNodesPerGraph: 100,
    enableBackup: true,
    backupInterval: 300000,
    rootSymbolPreferences: buildPreferences(preferences)
});

const createService = (options: {
    preferences?: Partial<RootSymbolPreferences>;
    date: Date;
}) => new RootSymbolService({
    configProvider: () => buildConfig(options.preferences ?? {}),
    dateProvider: () => options.date
});

const utcDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month - 1, day));

describe('RootSymbolService', () => {
    it('春季显示🌿', () => {
        const service = createService({ date: utcDate(2025, 3, 10) });
        expect(service.getRootSymbol()).toBe('🌿');
    });

    it('圣诞节显示🎄', () => {
        const service = createService({ date: utcDate(2025, 12, 25) });
        expect(service.getRootSymbol()).toBe('🎄');
    });

    it('万圣节呈现 🎃 或 👻', () => {
        const symbol = createService({ date: utcDate(2025, 10, 31) }).getRootSymbol();
        expect(['🎃', '👻']).toContain(symbol);
    });

    it('春节自动切换到🧧或🧨', () => {
        const symbol = createService({ date: utcDate(2025, 1, 29) }).getRootSymbol();
        expect(['🧧', '🧨']).toContain(symbol);
    });

    it('自定义覆盖模式优先', () => {
        const service = createService({
            date: utcDate(2025, 7, 1),
            preferences: {
                customSymbolMode: 'override',
                customSymbols: ['😺'],
                customSelectionStrategy: 'fixed'
            }
        });
        expect(service.getRootSymbol()).toBe('😺');
    });

    it('禁用节日与季节时使用自定义兜底', () => {
        const service = createService({
            date: utcDate(2025, 5, 20),
            preferences: {
                enableHolidayThemes: false,
                enableSeasonalThemes: false,
                customSymbolMode: 'fallback',
                customSymbols: ['🍀'],
                customSelectionStrategy: 'fixed'
            }
        });
        expect(service.getRootSymbol()).toBe('🍀');
    });

    it('无规则匹配时回退到默认🌲', () => {
        const service = createService({
            date: utcDate(2025, 5, 20),
            preferences: {
                enableHolidayThemes: false,
                enableSeasonalThemes: false,
                customSymbolMode: 'off'
            }
        });
        expect(service.getRootSymbol()).toBe('🌲');
    });
});
