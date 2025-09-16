import { Client } from "discord.js";

let client: Client;

const orgAbilities = {

    init(c: Client) {
        client = c;
    },

}

export default orgAbilities;