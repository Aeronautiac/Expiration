export const channels = {
    wataridescription: "1406120570554290196",
    ldescription: "1406120511372787712",
    legacyledgers: "1410045532658860103",
    hostLogs: "1423279320952209538",
    watariContactLogs: "1448401707074850980",
    news: "1448401475100348556",
    courtroom: "1423264458486317098",
    stolenContactLogs: "1448402227554291732",
    tfLounge: "1448402376452079759",
    kkLounge: "1448402016836653117",
    tfChiefDescription: "1406119727230619773", 
    anonymousCourtroom: "1423266570909651055",
    announcements: "1406115826876284973",
    general: "1448403616875417671",
    media: "1423264134803357716",
    lwatariLounge: "1423266620633255946",
    "playerList": "1406115827274612752",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;
