export const channels = {
    wataridescription: "placeholder",
    ldescription: "placeholder",
    legacyledgers: "placeholder",
    hostLogs: "1406169333280804885",
    watariContactLogs: "1406120605001973862",
    news: "1412595133756608644",
    bugLogs: "1411117992204570664",
    autopsyLogs: "1413357498974601316",
    courtroom: "1412595089858887743",
    tapinLogs: "1412595345481011240",
    stolenContactLogs: "1412998755795599376",
} as const satisfies { [channelName: string]: string };

export type ChannelName = keyof typeof channels;