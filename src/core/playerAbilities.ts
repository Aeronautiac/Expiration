import { Client } from "discord.js";
import death from "./death";
import agenda from "../jobs";
import util from "./util";
import { config } from "../configs/config";
import Player from "../models/player";
import { failure, success } from "../types/Result";
import names from "./names";
import { RoleName } from "../configs/roles";
import { PlayerAbilityArgs } from "../configs/abilityArgs";
import game from "./game";
import contacting from "./contacting";

let client: Client;

const module = {
    init(c: Client) {
        client = c;
    },

    async pseudocide(
        userId: string,
        args: PlayerAbilityArgs["pseudocide"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData)
            return failure("This user is not registered as a player.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");
        if (targetData.flags.get("ipp"))
            return failure("This user is under IPP.");

        if (checkOnly) return success();

        let affiliations = [];
        if (args.affiliationsString)
            affiliations = args.affiliationsString.split(", ");

        const target = await client.users.fetch(args.targetId);
        await target
            .send(
                "You have been pseudocided. Do not ask any players for information in the shinigami realm. If you do so, you will be punished."
            )
            .catch(() => {
                console.warn(
                    `Could not notify user ${args.targetId} of pseudocide.`
                );
            });

        // kill the target without sending a death announcement
        await death.kill(args.targetId, {
            dontSendDeathAnnouncement: true,
        });

        // announce their death with the fake message
        await death.announce(args.targetId, {
            deathMessage: args.message,
            ownedANotebook: args.hasNotebook,
            ownedBugAbility: args.hasBugAbility,
            trueName: args.trueName,
            role: args.role,
            affiliations: affiliations,
        });

        // schedule their revival for after the pseudocide period
        const reviveAt = new Date(
            Date.now() +
                util.hrsToMs(config.playerAbilities.pseudocide.duration)
        );
        await agenda.schedule(reviveAt, "pseudocideRevival", {
            userId: args.targetId,
            roleOnDeath: args.role,
        });

        return success();
    },

    async ipp(
        userId: string,
        args: PlayerAbilityArgs["ipp"],
        checkOnly?: boolean
    ) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This user has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");
        if (targetData.flags.get("ipp"))
            return failure("This user is already under IPP.");

        if (checkOnly) return success();

        targetData.flags.set("ipp", true);
        await targetData.save();

        names.setNick(
            args.targetId,
            `${names.getDisplay(args.targetId)} (IPP)`
        );

        return success();
    },

    async underTheRadar(
        userId: string,
        args: PlayerAbilityArgs["underTheRadar"],
        checkOnly?: boolean
    ) {
        await Player.findOneAndUpdate(
            { userId },
            { $set: { "flags.underTheRadar": true } }
        );
        return success();
    },

    async bug(userId: string, args: PlayerAbilityArgs["bug"], checkOnly?: boolean) {
        const targetData = await Player.findOne({ userId: args.targetId });
        if (!targetData) return failure("This user has no data.");
        if (!targetData.flags.get("alive"))
            return failure("This user is dead.");

        if (checkOnly) return success();

        await game.bug(args.targetId, "bug", userId);

        return success();
    },

    async anonymousAnnouncement(
        userId: string,
        args: PlayerAbilityArgs["anonymousAnnouncement"],
        checkOnly?: boolean
    ) {
        if (checkOnly) return success();
        await game.announce(`@everyone **???:** ${args.message}`);
        return success();
    },

    async anonymousContact(
        userId: string,
        args: PlayerAbilityArgs["anonymousContact"],
        checkOnly?: boolean
    ) {
        if (checkOnly) return success();
        return await contacting.contact(userId, args.targetId, true);
    },
};

export default module;
