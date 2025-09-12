import { Client } from "discord.js";

let client: Client;

const module = {

    init(c: Client) {
        client = c;
    },

}

export default module;