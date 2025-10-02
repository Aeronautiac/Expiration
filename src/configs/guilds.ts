export const guilds = {
    main: "1406115825844359314",
    "Kira": "1406119060227231784",
    "Beyond Birthday": "1406124666837536799",
    "Kira's Kingdom": "1406124121636737096",
    "Task Force": "1406119726656262205",
    lwatari: "1406120447501926500",
    "Private Investigator": "1406121249758908478",
    "2nd Kira": "1406120699654836344",
    notebook1: "1406302123901321216",
    notebook2: "1406302376083722270",
    notebook3: "1406302628450930708",
    watarilaptop: "1412998755430432788",
    "News Anchor": "1414838956171726870",
    "Rogue Civilian": "1414839208388071507"
} as const satisfies { [guildName: string]: string };

export type GuildName = keyof typeof guilds;
