import { Client, Guild, Role } from "discord.js";
import names from "./names";
import fs from "fs";
import config from "../../gameconfig.json";
import access from "./access";
import notebooks from "./notebooks";

import Player, { GameRole } from "../models/playerts";
import Notebook from "../models/notebookts";
import contacting from "./contacting";

let client: Client;

interface Game {
    // contacting
    addLoungeHider: (userId: string, reason: string) => Promise<void>,
    removeLoungeHider: (userId: string, reason: string) => Promise<void>,
    contact: (userId: string, targetId: string) => Promise<void>,
};

const game = {

    init: function(newClient: Client) {
        client = newClient;
    },

    // creates a player's data if there is none, gives the player the role specified, and revives them if they were dead
    // also returns their notebooks if they owned any and their notebooks were not taken from them
    // bans from all guilds except main. Unbans and invites to role guilds.
    async role(userId: string, role: GameRole, trueName?: string): Promise<void> {
        let playerData = await Player.findOne({userId});
        const user = await client.users.fetch(userId);

        if (!playerData) {
            const name = names.toReadable(trueName) ?? (await names.getUnique());

            playerData = await Player.create({
                userId,
                role,
                trueName: names.toInternal(name),
                contactTokens: config.dailyTokens,
            });

            await user.send(`Your true name is ${names.toReadable(name)}`);
        } else {
            await Player.updateOne({userId}, {
                $set: {"flags.alive": true, role}
            })

            const ownedNotebooks = await Notebook.find({ currentOwner: userId });
            for (const notebook of ownedNotebooks) {
                try {
                    await notebooks.set(notebook.guildId, userId);
                } catch (err) {
                    console.log("Failed to return notebook after revival:", err);
                }
            }
        }

        // restricts access to all guilds except main (this is called no matter what because your role could change even while alive.)
        // remove all old role abilities
        await removeOldAbilities(targetUser);
        await access.revokeAll(userId);

        // grants access to role guilds and abilities
        await grantRoleAbilities(targetUser, role);
        await access.grantRole(userId);

        await contacting.removeLoungeHider(userId, "dead");

        // roles
        const mainGuild = await client.guilds.fetch(config.guildIds.main);
        const member = await mainGuild.members
            .fetch(userId)
            .catch(() => null);
        if (member) {
            await member.roles
                .add(config.roleIds.Civilian)
                .catch(console.error);
            await member.roles
                .remove(config.roleIds.Shinigami)
                .catch(console.error);
        }
    },

};

export default game;