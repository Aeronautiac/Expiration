export const channels = {
    wataridescription: "placeholder",
    ldescription: "placeholder",
    legacyledgers: "placeholder",
    hostLogs: "1406169333280804885",
    watariContactLogs: "1406120605001973862",
    news: "1418665004378357892",
    bugLogs: "1411117992204570664",
    autopsyLogs: "1413357498974601316",
    courtroom: "1418665066508718251",
    tapinLogs: "1412595345481011240",
    stolenContactLogs: "1412998755795599376",
    tfLounge: "1412588001267024002",
    kkLounge: "1413357775379234958",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;
