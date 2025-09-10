export function hrsToMs(hrs: number): number {
    return hrs * 60 * 60 * 1000;
}

export function minsToMs(mins: number): number {
    return mins * 60 * 1000;
}

export function secsToMs(secs: number): number {
    return secs * 1000;
}

export async function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDiscordInteractionChoice(name: string): {  name: string; value: string } {
    return { name, value: name };
}