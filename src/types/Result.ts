export type Result = {
    success: boolean,
    message?: string,
}

export function failure(failMessage?: string): Result {
    return {
        success: false,
        message: failMessage
    }
}

export function success(successMessage?: string): Result {
    return {
        success: true,
        message: successMessage
    }
}