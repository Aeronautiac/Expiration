export const guilds = {
    main: "1406115825844359314",
    kira: "1406119060227231784",
    bb: "1406124666837536799",
    kk: "1406124121636737096",
    tf: "1406119726656262205",
    lwatari: "1406120447501926500",
    pi: "1406121249758908478",
    "2kira": "1406120699654836344",
    notebook1: "1406302123901321216",
    notebook2: "1406302376083722270",
    notebook3: "1406302628450930708",
    watarilaptop: "1412998755430432788",
    newsAnchor: "1414838956171726870",
    rogueCivilian: "1414839208388071507"
} as const satisfies { [guildName: string]: string };

export type GuildName = keyof typeof guilds;
