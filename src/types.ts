export type channel = {
    id: string;
    messages: {
        fetch: (arg0: { limit: number; }) => Promise<Map<string, { author: { bot: boolean; id: string; }; content: string; }>>;
        values: () => IterableIterator<{ author: { bot: boolean; id: string; }; content: string; }>;
    }
}

export type interaction = {
    deferReply: (arg0: { ephemeral?: boolean; }) => any;
    editReply: (arg0: { content: string | undefined; ephemeral?: boolean; }) => any;
    followUp: (arg0: { content: string; }) => any;

    client: {
        users: {
            fetch: (arg0: string) => Promise<{ username: string; }>;
        }
        guilds: {
            fetch: (arg0: string) => Promise<any>;
            cache: {
                get: (arg0: string) => { name: string; };
                has: (arg0: string) => boolean;
            }
        }
    };

    options: {
        getString: (arg0: string) => string | null;
        getBoolean: (arg0: string) => boolean | null;
        getUser: (arg0: string) => { id: string; } | null;
        getNumber: (arg0: string) => number | null;
    };

    user: { id: string; };
    guild: { id: string; };
    channel: { id: string; };
}