export const singlePlayerGuilds = [
    "Kira",
    "2nd Kira",
    "Beyond Birthday",
    "Private Investigator",
    "News Anchor",
    "Rogue Civilian"
] as const;

export type RoleName = typeof singlePlayerGuilds[number];
