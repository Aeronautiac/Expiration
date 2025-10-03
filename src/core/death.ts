import { Client, TextChannel } from "discord.js";
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
import { RoleName } from "../configs/roles";
import { OrgMember } from "../types/OrgMember";
import { singlePlayerGuilds } from "../configs/singlePlayerRoles";
import { guilds } from "../configs/guilds";

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
        userData.timeOfDeath = Date.now();
        await userData.save();

        // delete any bugs where they were the target
        await Bug.deleteMany({ targetId: userId, source: "bug" });

        // remove states like custody, kidnap, ipp
        await game.kidnapRelease(userId);
        await game.removeIncarcerated(userId);
        await game.removeCustody(userId);

        // give discord roles and strip their nickname to their base display name
        const mainGuild = await client.guilds.fetch(config.guilds.main);
        const member = await mainGuild.members
            .fetch(userId)
            .catch(console.error);
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
            owner: userId,
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
                await access.grant(args.killerId, [config.guilds.watarilaptop]);
                bugAbility.owner = args.killerId;
                bugAbility.roleRestrictions = [];
                await bugAbility.save();
            }

            killerData.playersKilled.push(userId);
            await killerData.save();
        }

        // revoke access to any notebooks still in their possession (can happen due to pseudocide)
        const toRevokeNotebooks = await Notebook.find({});
        const revokePromises = toRevokeNotebooks.map(async (book) => {
            await access.revoke(userId, book.guildId);
        });
        await Promise.all(revokePromises);

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
                memberObjects: await util.getMemberObjects(userId),
            });

            if (singlePlayerGuilds.includes(userData.role as typeof singlePlayerGuilds[number])) {
                // announce in role server
                const roleGuildId = guilds[userData.role];
                if (roleGuildId) {
                    const roleGuild = await client.guilds.fetch(roleGuildId);
                    const loungeChannel = roleGuild.channels.cache.find(
                        (channel) => channel.type === 0 && channel.name === "lounge"
                    ) as TextChannel;
                    if (loungeChannel) {
                        await loungeChannel.send(config.postDeathDiscussionMessage);
                    }
                }
            }
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
            memberObjects?: OrgMember[];
        }
    ) {
        if (!args.memberObjects) args.memberObjects = [];
        const user = await client.users.fetch(userId);
        const role = args.role;
        const deathReason =
            args.deathMessage ?? `They died to a sudden heart attack.`;

        // Compose the base death message
        let output = `@everyone ${user} (${names.toReadable(
            args.trueName
        )}) has died. ${deathReason}`;

        // Send the initial death message
        const deathMsg = await game.announce(output);

        // Wait 5 seconds before replying with the role/affiliation reveal
        await util.sleep(config.announcementDelay);

        // Determine the role/affiliation reveal message
        let revealMsg = "";

        function joinWithAnd(items: string[]): string {
            if (items.length === 0) return "";
            if (items.length === 1) return items[0];
            return (
                items.slice(0, -1).join(", ") +
                " and " +
                items[items.length - 1]
            );
        }

        const revealMessages: Map<RoleName, string> = new Map([
            ["Civilian", "They were just a "],
            ["Kira", "They were the god-like serial killer known as "],
            ["L", "They were the world's greatest detective known as "],
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
                `They were ${util.roleMention(
                    "Kira"
                )}'s most devoted supporter, `,
            ],
        ]);

        const roleAddition = revealMessages.get(role) ?? "They were ";
        revealMsg += roleAddition + util.roleMention(role);
        revealMsg += ".";

        // org reveals
        let orgParts: string[] = [];
        let noNewMembersParts: string[] = [];

        for (const member of args.memberObjects) {
            const orgConfig = config.organisations[member.org];
            const isLeader = member.leader;
            const starter = isLeader ? "the" : "a";
            const rank = isLeader
                ? orgConfig.rankNames["leader"]
                : orgConfig.rankNames["member"];

            // member of org
            orgParts.push(
                `${starter} ${rank} of ${util.articledOrgMention(member.org)}`
            );

            // leader of org
            if (isLeader)
                noNewMembersParts.push(
                    `${util.articledOrgMention(member.org)}`
                );
        }

        if (orgParts.length > 0) {
            revealMsg += `\nThey were also ${joinWithAnd(orgParts)}.`;
        }

        if (noNewMembersParts.length > 0) {
            revealMsg += ` Now no new members may join ${joinWithAnd(
                noNewMembersParts
            )}.`;
        }

        // Reply to the death message with the reveal
        await deathMsg.reply({
            content: revealMsg,
            allowedMentions: { parse: ["roles"] },
        });

        // handle death info like notebooks and bug ability transfers
        let possessionMessage = ``;
        if (args.ownedANotebook)
            possessionMessage += `Whoever is responsible for their death has now gained possession of their death note(s)`;

        if (args.ownedBugAbility && args.ownedANotebook)
            possessionMessage += ` and their bug and contact log abilities`;

        if (args.ownedBugAbility && !args.ownedANotebook)
            possessionMessage += `Whoever is responsible for their death has now gained possession of their bug and contact log abilities`;

        if (possessionMessage) possessionMessage += `.`;

        await util.sleep(config.announcementDelay);
        if (possessionMessage)
            await deathMsg.reply({
                content: possessionMessage,
            });
    },
};

export default death;
