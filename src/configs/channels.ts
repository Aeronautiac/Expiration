export const channels = {
    wataridescription: "1406120570554290196",
    ldescription: "1406120511372787712",
    legacyledgers: "1410045532658860103",
    hostLogs: "1423279320952209538",
    watariContactLogs: "1421729858274201680",
    news: "1423264547296383107",
    courtroom: "1423264458486317098",
    stolenContactLogs: "1421731328788922378",
    tfLounge: "1421730396671971379",
    kkLounge: "1421729745418195004",
    tfChiefDescription: "1406119727230619773", 
    anonymousCourtroom: "1421730067054067775",
    announcements: "1406115826876284973",
    general: "1421729455587725372",
    media: "1418665186302361750",
    lwatariLounge: "1421729673557311529",
    "playerList": "1406115827274612752",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;
