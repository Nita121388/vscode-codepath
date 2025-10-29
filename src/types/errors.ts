/**
 * Categorized error types for CodePath extension
 */
export type ErrorCategory = 'user' | 'filesystem' | 'validation' | 'rendering' | 'performance' | 'clipboard' | 'order' | 'menu' | 'network' | 'configuration' | 'integration';

/**
 * Recovery action types that can be suggested to users
 */
export type RecoveryAction = 
    | 'retry'
    | 'selectText'
    | 'checkPermissions'
    | 'restoreBackup'
    | 'switchToTextView'
    | 'reduceNodes'
    | 'clearClipboard'
    | 'refreshPreview'
    | 'reloadExtension'
    | 'checkConfiguration'
    | 'contactSupport'
    | 'none';

/**
 * Custom error class for CodePath extension with categorization and recovery suggestions
 */
export class CodePathError extends Error {
    public readonly category: ErrorCategory;
    public readonly recoverable: boolean;
    public readonly userMessage: string;
    public readonly suggestedAction: RecoveryAction;
    public readonly originalError?: Error;

    constructor(
        message: string,
        category: ErrorCategory,
        options: {
            recoverable?: boolean;
            userMessage?: string;
            suggestedAction?: RecoveryAction;
            originalError?: Error;
        } = {}
    ) {
        super(message);
        this.name = 'CodePathError';
        this.category = category;
        this.recoverable = options.recoverable ?? true;
        this.userMessage = options.userMessage ?? this.getDefaultUserMessage(category);
        this.suggestedAction = options.suggestedAction ?? this.getDefaultAction(category);
        this.originalError = options.originalError;
    }

    private getDefaultUserMessage(category: ErrorCategory): string {
        switch (category) {
            case 'user':
                return '请检查您的输入并重试。';
            case 'filesystem':
                return '文件操作失败。请检查权限并重试。';
            case 'validation':
                return '数据验证失败。无法完成操作。';
            case 'rendering':
                return '预览渲染失败。正在切换到文本视图。';
            case 'performance':
                return '达到性能限制。请考虑减少图表大小。';
            case 'clipboard':
                return '剪贴板操作失败。请重试。';
            case 'order':
                return '节点顺序操作失败。请检查节点位置并重试。';
            case 'menu':
                return '菜单操作失败。请重试或刷新界面。';
            case 'network':
                return '网络操作失败。请检查网络连接并重试。';
            case 'configuration':
                return '配置错误。请检查扩展设置。';
            case 'integration':
                return 'VS Code 集成失败。请重新加载扩展。';
            default:
                return '发生了意外错误。';
        }
    }

    private getDefaultAction(category: ErrorCategory): RecoveryAction {
        switch (category) {
            case 'user':
                return 'selectText';
            case 'filesystem':
                return 'checkPermissions';
            case 'validation':
                return 'retry';
            case 'rendering':
                return 'switchToTextView';
            case 'performance':
                return 'reduceNodes';
            case 'clipboard':
                return 'clearClipboard';
            case 'order':
                return 'refreshPreview';
            case 'menu':
                return 'refreshPreview';
            case 'network':
                return 'retry';
            case 'configuration':
                return 'checkConfiguration';
            case 'integration':
                return 'reloadExtension';
            default:
                return 'none';
        }
    }

    /**
     * Create a user input error
     */
    static userError(message: string, userMessage?: string, suggestedAction?: RecoveryAction): CodePathError {
        return new CodePathError(message, 'user', { userMessage, suggestedAction });
    }

    /**
     * Create a filesystem error
     */
    static filesystemError(message: string, originalError?: Error, userMessage?: string): CodePathError {
        return new CodePathError(message, 'filesystem', { 
            originalError, 
            userMessage,
            recoverable: true
        });
    }

    /**
     * Create a validation error
     */
    static validationError(message: string, userMessage?: string, recoverable = false): CodePathError {
        return new CodePathError(message, 'validation', { 
            userMessage, 
            recoverable,
            suggestedAction: recoverable ? 'retry' : 'none'
        });
    }

    /**
     * Create a rendering error
     */
    static renderingError(message: string, originalError?: Error): CodePathError {
        return new CodePathError(message, 'rendering', { 
            originalError,
            userMessage: 'Preview rendering failed. Switching to text view.',
            suggestedAction: 'switchToTextView'
        });
    }

    /**
     * Create a performance error
     */
    static performanceError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(message, 'performance', { 
            userMessage: userMessage ?? 'Performance limit reached. Consider reducing the graph size.',
            suggestedAction: 'reduceNodes'
        });
    }

    /**
     * Create a clipboard operation error
     */
    static clipboardError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`剪贴板操作失败: ${message}`, 'clipboard', {
            userMessage: userMessage ?? '剪贴板操作失败。请重试。',
            suggestedAction: 'clearClipboard'
        });
    }

    /**
     * Create a node order operation error
     */
    static orderError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`节点顺序操作失败: ${message}`, 'order', {
            userMessage: userMessage ?? '节点顺序操作失败。请检查节点位置并重试。',
            suggestedAction: 'refreshPreview'
        });
    }

    /**
     * Create a menu operation error
     */
    static menuError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`菜单操作失败: ${message}`, 'menu', {
            userMessage: userMessage ?? '菜单操作失败。请重试或刷新界面。',
            suggestedAction: 'refreshPreview'
        });
    }

    /**
     * Create a network operation error
     */
    static networkError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`网络操作失败: ${message}`, 'network', {
            userMessage: userMessage ?? '网络操作失败。请检查网络连接并重试。',
            suggestedAction: 'retry'
        });
    }

    /**
     * Create a configuration error
     */
    static configurationError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`配置错误: ${message}`, 'configuration', {
            userMessage: userMessage ?? '配置错误。请检查扩展设置。',
            suggestedAction: 'checkConfiguration'
        });
    }

    /**
     * Create an integration error
     */
    static integrationError(message: string, userMessage?: string): CodePathError {
        return new CodePathError(`VS Code 集成失败: ${message}`, 'integration', {
            userMessage: userMessage ?? 'VS Code 集成失败。请重新加载扩展。',
            suggestedAction: 'reloadExtension'
        });
    }

    /**
     * Get localized error message
     */
    getLocalizedMessage(locale: 'zh' | 'en' = 'zh'): string {
        if (locale === 'en') {
            return this.getEnglishMessage();
        }
        return this.userMessage;
    }

    private getEnglishMessage(): string {
        switch (this.category) {
            case 'user':
                return 'Please check your input and try again.';
            case 'filesystem':
                return 'File operation failed. Please check permissions and try again.';
            case 'validation':
                return 'Data validation failed. The operation cannot be completed.';
            case 'rendering':
                return 'Preview rendering failed. Switching to text view.';
            case 'performance':
                return 'Performance limit reached. Consider reducing the graph size.';
            case 'clipboard':
                return 'Clipboard operation failed. Please try again.';
            case 'order':
                return 'Node order operation failed. Please check node position and try again.';
            case 'menu':
                return 'Menu operation failed. Please try again or refresh the interface.';
            case 'network':
                return 'Network operation failed. Please check your connection and try again.';
            case 'configuration':
                return 'Configuration error. Please check extension settings.';
            case 'integration':
                return 'VS Code integration failed. Please reload the extension.';
            default:
                return 'An unexpected error occurred.';
        }
    }
}