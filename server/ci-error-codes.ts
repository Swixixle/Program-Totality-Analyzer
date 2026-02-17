/**
 * CI Error Codes - Normalized error classification for CI runs.
 * 
 * These codes provide deterministic error classification to help operators
 * distinguish between different failure modes instantly.
 */

export const CI_ERROR_CODES = {
  // Workdir validation failures
  WORKDIR_INVALID: 'WORKDIR_INVALID',
  WORKDIR_ESCAPE: 'WORKDIR_ESCAPE',
  
  // Repository size limit violations
  REPO_TOO_LARGE: 'REPO_TOO_LARGE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Analyzer execution failures
  ANALYZER_TIMEOUT: 'ANALYZER_TIMEOUT',
  ANALYZER_SCHEMA_INVALID: 'ANALYZER_SCHEMA_INVALID',
  ANALYZER_EXIT_CODE: 'ANALYZER_EXIT_CODE',
  ANALYZER_SPAWN_ERROR: 'ANALYZER_SPAWN_ERROR',
  PYTHON_NOT_FOUND: 'PYTHON_NOT_FOUND',
  
  // Infrastructure failures
  LOW_DISK_SPACE: 'LOW_DISK_SPACE',
  GIT_CLONE_FAILED: 'GIT_CLONE_FAILED',
  GIT_CHECKOUT_FAILED: 'GIT_CHECKOUT_FAILED',
  
  // Job queue failures
  MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
  
  // Unknown/unexpected failures
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type CiErrorCode = typeof CI_ERROR_CODES[keyof typeof CI_ERROR_CODES];

/**
 * Parse error message to extract error code.
 * 
 * Error messages should be formatted as: "ERROR_CODE: details"
 * If no code prefix found, returns UNKNOWN_ERROR.
 */
export function parseErrorCode(errorMessage: string | null | undefined): CiErrorCode {
  if (!errorMessage) {
    return CI_ERROR_CODES.UNKNOWN_ERROR;
  }
  
  // Check if message starts with a known error code
  for (const code of Object.values(CI_ERROR_CODES)) {
    if (errorMessage.startsWith(code)) {
      return code;
    }
  }
  
  // Legacy error message patterns
  if (errorMessage.includes('workdir_escape') || errorMessage.includes('workdir_validation')) {
    return CI_ERROR_CODES.WORKDIR_INVALID;
  }
  if (errorMessage.includes('repo_too_large')) {
    return CI_ERROR_CODES.REPO_TOO_LARGE;
  }
  if (errorMessage.includes('repo_too_many_files')) {
    return CI_ERROR_CODES.TOO_MANY_FILES;
  }
  if (errorMessage.includes('repo_file_too_large')) {
    return CI_ERROR_CODES.FILE_TOO_LARGE;
  }
  if (errorMessage.includes('timeout')) {
    return CI_ERROR_CODES.ANALYZER_TIMEOUT;
  }
  if (errorMessage.includes('python_not_found')) {
    return CI_ERROR_CODES.PYTHON_NOT_FOUND;
  }
  if (errorMessage.includes('ci_tmp_dir_low_disk')) {
    return CI_ERROR_CODES.LOW_DISK_SPACE;
  }
  if (errorMessage.includes('max_attempts')) {
    return CI_ERROR_CODES.MAX_ATTEMPTS_EXCEEDED;
  }
  if (errorMessage.includes('exit_code_')) {
    return CI_ERROR_CODES.ANALYZER_EXIT_CODE;
  }
  if (errorMessage.includes('spawn_error')) {
    return CI_ERROR_CODES.ANALYZER_SPAWN_ERROR;
  }
  
  return CI_ERROR_CODES.UNKNOWN_ERROR;
}

/**
 * Get human-readable description for an error code.
 */
export function getErrorDescription(code: CiErrorCode): string {
  const descriptions: Record<CiErrorCode, string> = {
    [CI_ERROR_CODES.WORKDIR_INVALID]: 'Working directory validation failed - possible security issue',
    [CI_ERROR_CODES.WORKDIR_ESCAPE]: 'Working directory path escape detected',
    [CI_ERROR_CODES.REPO_TOO_LARGE]: 'Repository size exceeds limit',
    [CI_ERROR_CODES.TOO_MANY_FILES]: 'Repository file count exceeds limit',
    [CI_ERROR_CODES.FILE_TOO_LARGE]: 'Individual file size exceeds limit',
    [CI_ERROR_CODES.ANALYZER_TIMEOUT]: 'Analyzer execution timed out',
    [CI_ERROR_CODES.ANALYZER_SCHEMA_INVALID]: 'Analyzer output failed schema validation',
    [CI_ERROR_CODES.ANALYZER_EXIT_CODE]: 'Analyzer exited with non-zero code',
    [CI_ERROR_CODES.ANALYZER_SPAWN_ERROR]: 'Failed to spawn analyzer process',
    [CI_ERROR_CODES.PYTHON_NOT_FOUND]: 'Python interpreter not found',
    [CI_ERROR_CODES.LOW_DISK_SPACE]: 'Insufficient disk space in CI workspace',
    [CI_ERROR_CODES.GIT_CLONE_FAILED]: 'Git clone operation failed',
    [CI_ERROR_CODES.GIT_CHECKOUT_FAILED]: 'Git checkout operation failed',
    [CI_ERROR_CODES.MAX_ATTEMPTS_EXCEEDED]: 'Job retry limit exceeded',
    [CI_ERROR_CODES.UNKNOWN_ERROR]: 'Unknown or unexpected error',
  };
  
  return descriptions[code] || 'Unknown error';
}
