export const categoryPrefixes = {
    monologue: "Monologues ",
    lounge: "Private Messages ",
    groupchat: "Group Chats ",
    kidnap: "Kidnapped ",
    buglog: "Bug & Custody Logs ",
    stolenbuglog: "Bug Logs ",
} as const satisfies { [categoryName: string]: string };

export type CategoryPrefixName = keyof typeof categoryPrefixes;