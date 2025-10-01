export const discordRoles = {
    Spectator: "1406115825844359315",
    Shinigami: "1406115825886167046",
    "Private Investigator": "1406115825957732546",
    "Beyond Birthday": "1406115825957732547",
    L: "1406115825957732552",
    Watari: "1406115825957732548",
    Kira: "1406115825957732553", 
    "2nd Kira": "1406115825957732551",
    Civilian: "1406115825886167047",
    "Rogue Civilian": "1406115825928376365",
    "News Anchor": "1406115825928376364",
    "Kira's Kingdom": "1406115825928376368",
    "Task Force": "1406115825928376367",
    Incarcerated: "1412394267556446228",
    Prosecutor: "1406115825928376361",
    Custody: "1406115825907269651",
    Kidnapped: "1406115825928376362",
    "Press Conference": "1419447605582106684"
} as const satisfies { [roleName: string]: string };

export type DiscordRoleName = keyof typeof discordRoles;
