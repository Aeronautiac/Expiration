import { Client } from "discord.js";
import access from "./access";
import game from "./game";
import { config } from "../configs/config";
import Bug from "../models/bug";
import notebooks from "./notebooks";
import Player from "../models/player";
import Notebook from "../models/notebook";
import Ability from "../models/ability";
import names from "./names";
import util from "./util";
import { OrganisationName } from "../configs/organisations";
import { RoleName } from "../configs/roles";

let client: Client;

const death = {
    init: function (newClient: Client) {
        client = newClient;
    },

    async kill(
        userId: string,
        args: {
            killerId?: string;
            deathMessage?: string;
            dontSendDeathAnnouncement?: boolean;
            bypassIPP?: boolean;
        } = {}
    ) {
        const userData = await Player.findOne({ userId });
        if (!userData) throw new Error("Player does not exist.");

        // IPP protection
        if (!args.bypassIPP && userData.flags.get("ipp")) return;

        // mark as dead
        await util.addState(userId, "dead");
        userData.flags.set("alive", false);
        await userData.save();

        // delete any bugs where they were the target
        await Bug.deleteMany({ targetId: userId, source: "bug" });

        // remove states like custody, kidnap, ipp
        await game.kidnapRelease(userId);
        await game.removeIncarcerated(userId);
        await game.removeCustody(userId);

        // give discord roles and strip their nickname to their base display name
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles
                .remove(config.discordRoles.Civilian)
                .catch(console.error);
            await member.roles
                .add(config.discordRoles.Shinigami)
                .catch(console.error);
            await member.roles
                .remove(config.discordRoles.Prosecutor)
                .catch(console.error);
        }
        await names.setNick(userId, await names.getAlias(userId));

        const bugAbility = await Ability.findOne({
            ownerId: userId,
            ability: "bug",
        });
        const ownedNotebooks = await Notebook.find({ currentOwner: userId });

        // handle player kill
        if (args.killerId && args.killerId !== userId) {
            const killerData = await Player.findOne({ userId: args.killerId });
            if (!killerData) throw new Error("Killer does not exist.");

            // transfer notebooks
            const promises = ownedNotebooks.map(async (notebook) => {
                if (notebook.temporaryOwner) return; // don't transfer notebooks that are temporarily owned (i.e. stolen). they will return at the end of the day.
                await notebooks.setOwner(notebook.guildId, args.killerId!);
            });
            await Promise.all(promises);

            // transfer bugs and bug ability
            if (bugAbility) {
                // transfer bugs
                const activeBugs = await Bug.find({ targetId: userId });
                const bugPromises = activeBugs.map(async (bug) => {
                    bug.buggedBy = args.killerId;
                    bug.channelIds.delete("watari"); // remove watari channel if it exists
                    await bug.save();
                });
                await Promise.all(bugPromises);

                // transfer bug ability
                await access.revoke(userId, config.guilds.watarilaptop);
                await access.grant(args.killerId, config.guilds.watarilaptop);
                bugAbility.ownerId = args.killerId;
                bugAbility.roleRestriction = undefined;
                await bugAbility.save();
            }

            killerData.playersKilled.push(userId);
            await killerData.save();
        }

        // death announcement
        const wasKilledByPlayer = args.killerId && args.killerId !== userId;
        if (!args.dontSendDeathAnnouncement) {
            await death.announce(userId, {
                trueName: userData.trueName,
                wasKilledByPlayer: wasKilledByPlayer,
                deathMessage: args.deathMessage,
                ownedANotebook: ownedNotebooks.length > 0,
                ownedBugAbility:
                    bugAbility !== undefined && bugAbility !== null,
                role: userData.role,
                affiliations: userData.affiliations,
            });
        }
    },

    async announce(
        userId: string,
        args: {
            wasKilledByPlayer?: boolean;
            deathMessage?: string;
            ownedANotebook?: boolean;
            ownedBugAbility?: boolean;
            trueName: string;
            role: RoleName;
            affiliations?: string[];
        }
    ) {
        const user = await client.users.fetch(userId);
        const alias = await names.getAlias(userId);
        const role = args.role;
        const deathReason =
            args.deathMessage ?? `They died to a sudden heart attack`;

        // Compose the base death message
        let output = `@everyone ${user} (${alias}) has died. ${deathReason}`;

        // Send the initial death message
        const deathMsg = await game.announce(output);

        // Wait 5 seconds before replying with the role/affiliation reveal
        await util.sleep(config.announcementDelay);

        // Determine the role/affiliation reveal message
        let revealMsg = "";
        const affiliations = args.affiliations ?? [];

        const orgMention = (org: OrganisationName) => {
            const id = config.discordRoles[org];
            return id ? `<@&${id}>` : org;
        };

        const revealMessages: Map<RoleName, string> = new Map([
            ["Civilian", "They were just a "],
            ["Kira", "They were the world's most prolific serial killer, "],
            ["L", "They were the world's greatest detective, "],
            ["Rogue Civilian", "They were the unpredictable "],
            ["Private Investigator", "They were the vengeful "],
            ["News Anchor", "They were the voice of the people, the "],
            ["Beyond Birthday", "They were the enigmatic figure known as "],
            [
                "Watari",
                `They were the genius inventor and ${util.roleMention(
                    "L"
                )}'s loyal handler, `,
            ],
            [
                "2nd Kira",
                `They were ${util.roleMention("Kira")}'s most devoted supporter, `,
            ],
        ]);

        const roleAddition = revealMessages.get(role) ?? "They were ";
        revealMsg += roleAddition + util.roleMention(role);

        const chiefs = affiliations.filter((a) => a.endsWith("Chief"));
        const orgs = affiliations.filter(
            (a) => !a.endsWith("Chief")
        ) as OrganisationName[];

        if (orgs.length === 1 && chiefs.length === 0) {
            // Single org, not chief
            revealMsg += ` and member of the ${orgMention(orgs[0])}.`;
        } else if (orgs.length > 1 && chiefs.length === 0) {
            // Multiple orgs, not chief
            const mentions = orgs.map(orgMention);
            revealMsg += ` and members of the ${mentions
                .slice(0, -1)
                .join(", ")} and ${mentions.slice(-1)}.`;
        } else if (
            orgs.length === 1 &&
            chiefs.length === 1 &&
            chiefs[0].startsWith(orgs[0])
        ) {
            // Chief of their only org
            const chiefOrg = orgs[0];
            revealMsg += ` and the chief of the ${orgMention(
                chiefOrg
            )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
        } else if (orgs.length > 0 && chiefs.length > 0) {
            // Member of orgs and also chief(s)
            const mentions = orgs.map(orgMention);
            let msg = ` and members of the ${mentions.slice(0, -1).join(", ")}${
                orgs.length > 1 ? " and " : ""
            }${mentions.slice(-1)}.`;
            // List all chief roles
            for (const chief of chiefs) {
                const chiefOrg = chief.replace(
                    / Chief$/,
                    ""
                ) as OrganisationName;
                msg += ` They were also the chief of the ${orgMention(
                    chiefOrg
                )}. Now no new members may join the ${orgMention(chiefOrg)}.`;
            }
            revealMsg += msg;
        }

        // Reply to the death message with the reveal
        await deathMsg.reply({
            content: revealMsg,
            allowedMentions: { parse: ["roles"] },
        });

        // If they had a notebook, announce it
        if (args.ownedANotebook) {
            await util.sleep(config.announcementDelay);
            await deathMsg.reply({
                content: `Whoever is responsible has now gained possession of their death note(s).`,
            });
        }

        // If they had the bug ability, announce it
        if (args.ownedBugAbility) {
            await util.sleep(config.announcementDelay);
            await deathMsg.reply({
                content: `Whoever is responsible has now gained possession of their bug and contact log abilities.`,
            });
        }
    },
};

export default death;
