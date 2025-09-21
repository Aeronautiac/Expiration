export const channels = {
    wataridescription: "1406120570554290196",
    ldescription: "1406120511372787712",
    legacyledgers: "1410045532658860103",
    hostLogs: "1406169333280804885",
    watariContactLogs: "1406120605001973862",
    news: "1418665004378357892",
    bugLogs: "1411117992204570664",
    autopsyLogs: "1413357498974601316",
    courtroom: "1418665066508718251",
    tapinLogs: "1412595345481011240",
    stolenContactLogs: "1412998755795599376",
    tfLounge: "1418777440389693450",
    kkLounge: "1419379499711074425",
    tfChiefDescription: "1406119727230619773",
    anonymousCourtroom: "1419078492792033463",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;
