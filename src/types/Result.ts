export type Result = {
    success: boolean,
    message?: string,
    data?: Record<string, unknown>,
}

export function failure(failMessage?: string, data?: Record<string, unknown>): Result {
    return {
        success: false,
        message: failMessage
    }
}

export function success(successMessage?: string, data?: Record<string, unknown>): Result {
    return {
        success: true,
        message: successMessage
    }
}