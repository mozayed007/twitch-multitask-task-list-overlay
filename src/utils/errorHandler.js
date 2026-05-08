/**
 * Centralized Error Handler
 * Provides consistent error handling across the application
 */

/**
 * Error types for categorization
 */
export const ErrorType = {
	VALIDATION: 'validation',
	STORAGE: 'storage',
	NETWORK: 'network',
	AUTH: 'auth',
	COMMAND: 'command',
	UNKNOWN: 'unknown'
};

/**
 * Application error class
 */
export class AppError extends Error {
	constructor(message, type = ErrorType.UNKNOWN, originalError = null) {
		super(message);
		this.name = 'AppError';
		this.type = type;
		this.originalError = originalError;
		this.timestamp = new Date().toISOString();
	}

	/**
	 * Get user-friendly error message
	 * @returns {string} User-friendly message
	 */
	getUserMessage() {
		switch (this.type) {
			case ErrorType.VALIDATION:
				return `Validation error: ${this.message}`;
			case ErrorType.STORAGE:
				return 'Unable to save data. Please check your browser storage settings.';
			case ErrorType.NETWORK:
				return 'Connection error. Please check your internet connection.';
			case ErrorType.AUTH:
				return 'Authentication failed. Please check your OAuth token.';
			case ErrorType.COMMAND:
				return this.message;
			default:
				return 'An unexpected error occurred. Please try again.';
		}
	}

	/**
	 * Log the error with context
	 */
	log() {
		console.error(`[${this.type.toUpperCase()}] ${this.message}`, {
			timestamp: this.timestamp,
			originalError: this.originalError
		});
	}
}

/**
 * Handle errors consistently
 * @param {Error|AppError} error - The error to handle
 * @param {Object} context - Additional context
 * @returns {AppError} Processed error
 */
export function handleError(error, context = {}) {
	// Convert regular Error to AppError if needed
	let appError = error instanceof AppError
		? error
		: new AppError(error.message, ErrorType.UNKNOWN, error);

	// Add context to error
	appError.context = context;

	// Log the error
	appError.log();

	return appError;
}

/**
 * Handle validation errors
 * @param {string} message - Validation error message
 * @param {Object} context - Additional context
 * @returns {AppError} Validation error
 */
export function handleValidationError(message, context = {}) {
	const error = new AppError(message, ErrorType.VALIDATION);
	error.context = context;
	error.log();
	return error;
}

/**
 * Handle storage errors
 * @param {Error} originalError - Original error
 * @param {Object} context - Additional context
 * @returns {AppError} Storage error
 */
export function handleStorageError(originalError, context = {}) {
	const error = new AppError(
		originalError.message || 'Storage operation failed',
		ErrorType.STORAGE,
		originalError
	);
	error.context = context;
	error.log();
	return error;
}

/**
 * Handle network errors
 * @param {Error} originalError - Original error
 * @param {Object} context - Additional context
 * @returns {AppError} Network error
 */
export function handleNetworkError(originalError, context = {}) {
	const error = new AppError(
		originalError.message || 'Network operation failed',
		ErrorType.NETWORK,
		originalError
	);
	error.context = context;
	error.log();
	return error;
}

/**
 * Handle command errors
 * @param {string} message - Command error message
 * @param {Object} context - Additional context
 * @returns {AppError} Command error
 */
export function handleCommandError(message, context = {}) {
	const error = new AppError(message, ErrorType.COMMAND);
	error.context = context;
	error.log();
	return error;
}

/**
 * Wrap async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} context - Context for error handling
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = {}) {
	return async (...args) => {
		try {
			return await fn(...args);
		} catch (error) {
			handleError(error, context);
			throw error; // Re-throw for caller to handle
		}
	};
}

/**
 * Safe execute function that catches errors
 * @param {Function} fn - Function to execute
 * @param {*} defaultValue - Default value if error occurs
 * @returns {*} Result or default value
 */
export function safeExecute(fn, defaultValue = null) {
	try {
		return fn();
	} catch (error) {
		handleError(error);
		return defaultValue;
	}
}