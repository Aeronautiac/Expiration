export const channels = {
    wataridescription: "1406120570554290196",
    ldescription: "1406120511372787712",
    legacyledgers: "1410045532658860103",
    hostLogs: "1423279320952209538",
    watariContactLogs: "1423266546335223818",
    news: "1423264547296383107",
    courtroom: "1423264458486317098",
    stolenContactLogs: "1423266357507784704",
    tfLounge: "1423266440299155556",
    kkLounge: "1423266835997917295",
    tfChiefDescription: "1406119727230619773", 
    anonymousCourtroom: "1423266570909651055",
    announcements: "1406115826876284973",
    general: "1423264400545939557",
    media: "1423264134803357716",
    lwatariLounge: "1423266620633255946",
    "playerList": "1406115827274612752",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;
