import type { PlayerState } from "./types";

export const playerStates = {
    custody: {
        restrictsContacts: false,
        restrictsNotebookWriting: true,
        restrictsNotebookPassing: true,
        restrictsAbilities: true
    },
    kidnapped: {
        restrictsContacts: true,
        restrictsNotebookWriting: false,
        restrictsNotebookPassing: true,
        restrictsAbilities: true
    },
    incarcerated: {
        restrictsContacts: true,
        restrictsNotebookWriting: false,
        restrictsNotebookPassing: true,
        restrictsAbilities: true
    },
    dead: {
        restrictsContacts: true,
        restrictsNotebookWriting: true,
        restrictsNotebookPassing: true,
        restrictsAbilities: true
    }
} as const satisfies { [stateName: string]: PlayerState };

export type PlayerStateName = keyof typeof playerStates;