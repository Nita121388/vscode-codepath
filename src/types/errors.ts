/**
 * Categorized error types for CodePath extension
 */
export type ErrorCategory = 'user' | 'filesystem' | 'validation' | 'rendering' | 'performance';

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
                return 'Please check your input and try again.';
            case 'filesystem':
                return 'File operation failed. Please check permissions and try again.';
            case 'validation':
                return 'Data validation failed. The operation cannot be completed.';
            case 'rendering':
                return 'Preview rendering failed. Switching to text view.';
            case 'performance':
                return 'Performance limit reached. Consider reducing the graph size.';
            default:
                return 'An unexpected error occurred.';
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
}