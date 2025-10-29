import { Configuration, RootSymbolPreferences } from '../types';

type ConfigurationProvider = () => (Configuration | { rootSymbolPreferences: RootSymbolPreferences } | null | undefined);

interface RootSymbolServiceOptions {
    configProvider?: ConfigurationProvider;
    dateProvider?: () => Date;
}

interface FestivalRange {
    start: string; // 格式：YYYY-MM-DD
    length: number;
}

const DEFAULT_SYMBOL = '🌲';

const DEFAULT_PREFERENCES: RootSymbolPreferences = {
    enableHolidayThemes: true,
    enableSeasonalThemes: true,
    customSymbolMode: 'fallback',
    customSymbols: [],
    customSelectionStrategy: 'daily'
};

const CHINESE_NEW_YEAR: Record<number, FestivalRange> = {
    2023: { start: '2023-01-22', length: 7 },
    2024: { start: '2024-02-10', length: 7 },
    2025: { start: '2025-01-29', length: 7 },
    2026: { start: '2026-02-17', length: 7 },
    2027: { start: '2027-02-06', length: 7 },
    2028: { start: '2028-01-26', length: 7 },
    2029: { start: '2029-02-13', length: 7 },
    2030: { start: '2030-02-03', length: 7 },
    2031: { start: '2031-01-23', length: 7 },
    2032: { start: '2032-02-11', length: 7 },
    2033: { start: '2033-01-31', length: 7 },
    2034: { start: '2034-02-19', length: 7 },
    2035: { start: '2035-02-08', length: 7 }
};

const MID_AUTUMN_FESTIVAL: Record<number, FestivalRange> = {
    2023: { start: '2023-09-29', length: 3 },
    2024: { start: '2024-09-17', length: 3 },
    2025: { start: '2025-10-06', length: 3 },
    2026: { start: '2026-09-25', length: 3 },
    2027: { start: '2027-09-15', length: 3 },
    2028: { start: '2028-10-03', length: 3 },
    2029: { start: '2029-09-22', length: 3 },
    2030: { start: '2030-09-11', length: 3 },
    2031: { start: '2031-09-30', length: 3 },
    2032: { start: '2032-09-17', length: 3 },
    2033: { start: '2033-10-06', length: 3 },
    2034: { start: '2034-09-25', length: 3 },
    2035: { start: '2035-09-14', length: 3 }
};

/**
 * 根节点符号服务，负责根据节日、季节以及用户偏好计算展示符号
 */
export class RootSymbolService {
    private readonly configProvider?: ConfigurationProvider;
    private readonly dateProvider: () => Date;

    constructor(options?: RootSymbolServiceOptions) {
        this.configProvider = options?.configProvider;
        this.dateProvider = options?.dateProvider ?? (() => new Date());
    }

    /**
     * 获取当前根节点符号
     */
    public getRootSymbol(): string {
        const today = this.dateProvider();
        const preferences = this.resolvePreferences();

        // 自定义表情覆盖模式优先
        // 自定义覆盖模式优先级最高，若存在符合条件的符号直接返回
        // 自定义覆盖模式优先级最高，若存在符合条件的符号直接返回
        if (preferences.customSymbolMode === 'override') {
            const customSymbol = this.selectCustomSymbol(preferences, today);
            if (customSymbol) {
                return customSymbol;
            }
        }

                // 节日主题优先匹配
        if (preferences.enableHolidayThemes) {
            const holidaySymbol = this.resolveHolidaySymbol(today);
            if (holidaySymbol) {
                return holidaySymbol;
            }
        }

                // 季节主题暂时关闭，如需启用可取消注释
        // if (preferences.enableSeasonalThemes) {
        //     const seasonalSymbol = this.resolveSeasonalSymbol(today);
        //     if (seasonalSymbol) {
        //         return seasonalSymbol;
        //     }
        // }

        // 自定义兜底
        // 自定义符号作为兜底策略，仅在其他主题都未命中时启用
                // 自定义符号作为兜底策略，仅在其他主题都未命中时启用
        if (preferences.customSymbolMode === 'fallback') {
            const customSymbol = this.selectCustomSymbol(preferences, today);
            if (customSymbol) {
                return customSymbol;
            }
        }

        return DEFAULT_SYMBOL;
    }

    /**
     * 解析节日符号
     */
    private resolveHolidaySymbol(date: Date): string | null {
        const month = date.getMonth() + 1;
        const day = date.getDate();

                // 圣诞节：固定日期 12 月 24-26 日
        if (this.isWithinRange(date, { month: 12, day: 24 }, { month: 12, day: 26 })) {
            return this.pickSymbol(['🎄'], 'christmas', date, 'fixed');
        }

                // 万圣节：固定日期 10 月 31 日
        if (this.isWithinRange(date, { month: 10, day: 31 }, { month: 10, day: 31 })) {
            return this.pickSymbol(['🎃', '👻'], 'halloween', date, 'daily');
        }

                // 情人节：固定日期 2 月 14 日
        if (month === 2 && day === 14) {
            return this.pickSymbol(['💖'], 'valentines', date, 'fixed');
        }

                // 春节：支持 2023-2035 年的精确日期范围
        if (this.isFestival(date, CHINESE_NEW_YEAR)) {
            return this.pickSymbol(['🧧', '🧨'], 'spring-festival', date, 'daily');
        }

                // 中秋节：支持 2023-2035 年的精确日期范围
        if (this.isFestival(date, MID_AUTUMN_FESTIVAL)) {
            return this.pickSymbol(['🥮'], 'mid-autumn', date, 'fixed');
        }

        return null;
    }

    /**
     * 解析季节符号
     */
    private resolveSeasonalSymbol(date: Date): string {
        const month = date.getMonth() + 1;

        if ([3, 4, 5].includes(month)) {
            return '🌿';
        }

        if ([6, 7, 8].includes(month)) {
            return '☀️';
        }

        if ([9, 10, 11].includes(month)) {
            return '🍁';
        }

        return '❄️';
    }

    /**
     * 从自定义表情池中获取符号
     */
    private selectCustomSymbol(preferences: RootSymbolPreferences, date: Date): string | null {
        const symbols = preferences.customSymbols;
        if (!symbols || symbols.length === 0) {
            return null;
        }

        if (preferences.customSelectionStrategy === 'fixed' || symbols.length === 1) {
            return symbols[0];
        }

        return this.pickSymbol(symbols, 'custom', date, 'daily');
    }

    /**
     * 基于日期的稳定选择算法，避免刷新导致符号频繁变动
     */
    private pickSymbol(
        symbols: string[],
        key: string,
        date: Date,
        strategy: 'fixed' | 'daily'
    ): string {
        if (symbols.length === 0) {
            return DEFAULT_SYMBOL;
        }

        if (strategy === 'fixed' || symbols.length === 1) {
            return symbols[0];
        }

        const seed = `${key}-${this.getDateKey(date)}`;
        const index = this.hashToIndex(seed, symbols.length);
        return symbols[index];
    }

    /**
     * 解析配置，加入默认值与防御性拷贝
     */
    private resolvePreferences(): RootSymbolPreferences {
        const fallback = this.clonePreferences(DEFAULT_PREFERENCES);

        if (!this.configProvider) {
            return fallback;
        }

        try {
            const config = this.configProvider();

            if (config && (config as Configuration).rootSymbolPreferences) {
                const preferences = (config as Configuration).rootSymbolPreferences;
                return {
                    ...fallback,
                    ...preferences,
                    customSymbols: [...preferences.customSymbols]
                };
            }
        } catch (error) {
            console.warn('RootSymbolService: 读取配置失败，将使用默认符号设置', error);
        }

        return fallback;
    }

    /**
     * 判断是否落在固定公历范围内
     */
    private isWithinRange(
        date: Date,
        start: { month: number; day: number },
        end: { month: number; day: number }
    ): boolean {
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const startOrdinal = this.toOrdinal(start.month, start.day);
        const endOrdinal = this.toOrdinal(end.month, end.day);
        const currentOrdinal = this.toOrdinal(month, day);

        return currentOrdinal >= startOrdinal && currentOrdinal <= endOrdinal;
    }

    /**
     * 判断是否落在指定节日表中（支持跨年范围）
     */
    private isFestival(date: Date, lookup: Record<number, FestivalRange>): boolean {
        const year = date.getFullYear();
        const record = lookup[year];
        if (!record) {
            return false;
        }

        const start = new Date(record.start);
        const end = new Date(start);
        end.setDate(start.getDate() + record.length - 1);

        return date >= start && date <= end;
    }

    /**
     * 将月份和日期转换为序号，便于比较
     */
    private toOrdinal(month: number, day: number): number {
        return month * 100 + day;
    }

    /**
     * 生成日期 key（YYYY-MM-DD）
     */
    private getDateKey(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 将字符串哈希到索引
     */
    private hashToIndex(seed: string, modulo: number): number {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0; // 转换为 32 位整数
        }

        return Math.abs(hash) % modulo;
    }

    /**
     * 深拷贝偏好设置，避免外部修改
     */
    private clonePreferences(preferences: RootSymbolPreferences): RootSymbolPreferences {
        return {
            ...preferences,
            customSymbols: [...preferences.customSymbols]
        };
    }
}
