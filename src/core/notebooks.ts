import { Client } from "discord.js";
import access from "./access";
import Notebook from "../models/notebook";
import Player from "../models/player";
import { failure, Result, success } from "../types/Result";
import names from "./names";
import agenda from "../jobs";
import util from "./util";
import game from "./game";
import death from "./death";
import Season from "../models/season";

let client: Client;

const notebooks = {
    init: function (newClient: Client) {
        client = newClient;
    },

    // if guild is not a notebook yet, this function creates a new notebook and sets the current and original owner to owner.
    // if guild is already a notebook, the notebook's current owner is updated to the next owner.
    // grants and revokes guild access as necessary.
    // if temporary is true, then instead of current owner being changed, temporary owner is changed. notebooks with temporary owners
    // are sent back to their current owners when the next day begins even if the temporary owner died with it.
    async setOwner(
        guildId: string,
        ownerId: string,
        temporary?: boolean,
        fake?: boolean,
    ): Promise<void> {
        const existingBook = await Notebook.findOne({ guildId });

        if (existingBook) {
            const currentHolder =
                existingBook.temporaryOwner ?? existingBook.currentOwner;
            const newHolder = ownerId;

            // // if the current holder and new holder are the same, do nothing
            // if (currentHolder === newHolder) return;

            // if temporary, change the temporary owner field, otherwise, change current owner
            if (temporary) {
                await Notebook.updateOne(
                    { _id: existingBook._id },
                    { temporaryOwner: ownerId }
                );
            } else {
                if (existingBook.currentOwner !== ownerId)
                    await Notebook.updateOne(
                        { _id: existingBook._id },
                        { currentOwner: ownerId }
                    );
            }

            // if the person holding the notebook, changed, revoke access from the old and grant to the new.
            if (newHolder !== currentHolder) {
                await access.revoke(currentHolder, guildId);
                await access.grant(newHolder, [guildId]);
            }

            // if the notebook was being held temporarily before the posession change, then remove the temporary owner field
            if (existingBook.temporaryOwner && !temporary) {
                await Notebook.updateOne(
                    { _id: existingBook._id },
                    { $unset: { temporaryOwner: "" } }
                );
            }

            return;
        }

        await Notebook.create({
            guildId,
            currentOwner: ownerId,
            originalOwner: ownerId,
            fake
        });

        await access.grant(ownerId, [guildId]);
    },

    async returnNotebooks() {
        const temporaryOwnedNotebooks = await Notebook.find({
            temporaryOwner: { $ne: null },
        });

        await Promise.all(
            temporaryOwnedNotebooks.map(async (notebook) => {
                try {
                    await notebooks.setOwner(
                        notebook.guildId,
                        notebook.currentOwner
                    );
                } catch (err) {
                    console.log("Failed to return notebook:", err);
                }
            })
        );
    },

    async write(
        userId: string,
        guildId: string,
        trueName: string,
        args: {
            deathMessage?: string;
            delay?: number;
        }
    ): Promise<Result> {
        const season = await Season.findOne({});
        if (!season || !season.flags.get("active"))
            return failure("The season is not yet active.");

        const notebook = await Notebook.findOne({ guildId });
        const player = await Player.findOne({ userId });

        // is the server a death note server?
        if (!notebook)
            return failure("You can only use this command in a death note.");

        // does the user possess the death note?
        if (
            notebook.currentOwner !== userId &&
            notebook.temporaryOwner !== userId
        )
            return failure("You do not currently possess this death note.");

        // does the user have any write restrictions?
        if (player.notebookWriteRestrictors.size > 0)
            return failure(
                `You cannot use death notes right now. Reason(s): ${Array.from(
                    player.notebookWriteRestrictors
                )
                    .filter(([_, value]) => value)
                    .map(([key]) => key)
                    .join(", ")}`
            );

        // if the user is 2nd Kira, then they cannot use their notebook until they have connected with Kira.
        if (player.role === "2nd Kira" && !player.flags.get("kiraConnection"))
            return failure(
                "You cannot use your death note until you have connected with Kira."
            );

        // has the user already killed someone or scheduled someone's death with this notebook today?
        if (notebook.usedToday.includes(userId))
            return failure("You have already used this death note today.");

        // find the target player
        const targetPlayer = await Player.findOne({
            trueName: names.toInternal(trueName),
        });

        // if the person with this name is already dead, then return a failure
        if (targetPlayer && !targetPlayer.flags.get("alive"))
            return failure("This person is already dead.");

        // if nobody has this true name or the notebook is fake, then subtract a use and return a failure.
        if (!targetPlayer || !targetPlayer.flags.get("alive") || notebook.fake) {
            notebook.attemptsToday.set(
                userId,
                Math.max(0, (notebook.attemptsToday.get(userId) ?? 3) - 1)
            );
            await notebook.save();
            return failure(
                `There are no players with this true name. You have ${notebook.attemptsToday.get(
                    userId
                )} attempts remaining today.`
            );
        }

        // have they exhausted their attempts for today?
        if (notebook.attemptsToday.get(userId) === 0)
            return failure(
                "You have 0 attempts remaining. Try again tomorrow."
            );

        // beyond this point, the user has successfully used the notebook, so add them to the usedToday array
        await Notebook.updateOne(
            { _id: notebook._id },
            { $push: { usedToday: userId } }
        );

        // if the user is under ipp, then return a success, but say the user survived because of IPP.
        if (targetPlayer.flags.get("ipp"))
            return failure(`Something saved them...`);

        // if the target has any deaths scheduled, then delete the scheduled death and return a success.
        // (need to rewrite scheduled deaths using agenda)
        // the scheduled death acts as single use kill immunity.
        const existingScheduledDeath = await agenda.jobs({
            name: "scheduledKill",
            "data.userId": targetPlayer.userId,
        });
        if (existingScheduledDeath.length > 0) {
            await Promise.all(
                existingScheduledDeath.map(async (job) => {
                    await job.remove();
                })
            );
            return failure(`Something saved them...`);
        }

        // if the user chose to schedule the death, then schedule it and return a success.
        if (args.delay && args.delay > 0) {
            const timeNow = Date.now();
            const delayInMs = util.minToMs(args.delay);
            const runAt = new Date(timeNow + delayInMs);

            await agenda.schedule(runAt, "scheduledKill", {
                userId: targetPlayer.userId,
                deathMessage: args.deathMessage,
                killerId: userId,
            });

            return success();
        }

        // otherwise, kill the target immediately and return a success.
        await death.kill(targetPlayer.userId, {
            deathMessage: args.deathMessage,
            killerId: userId,
        });
        return success();
    },

    async pass(
        userId: string,
        guildId: string,
        newOwnerId: string
    ): Promise<Result> {
        const season = await Season.findOne({});
        if (!season || !season.flags.get("active"))
            return failure("The season is not yet active.");

        const notebook = await Notebook.findOne({ guildId });
        if (!notebook) return failure("Notebook not found.");

        const player = await Player.findOne({ userId });
        if (!player) return failure("You are not a player.");

        // is the user alive?
        if (!player.flags.get("alive"))
            return failure("You cannot pass death notes while dead.");

        // does the user possess the death note?
        if (notebook.currentOwner !== userId)
            return failure("You do not currently possess this death note.");

        // does the user have any pass restrictions?
        if (player.notebookPassRestrictors.size > 0)
            return failure(
                `You cannot pass death notes right now. Reason(s): ${Array.from(
                    player.notebookPassRestrictors
                ).join(", ")}`
            );

        await notebooks.setOwner(guildId, newOwnerId, true);

        return success();
    },

    async resetDailyUsage(): Promise<void> {
        await Notebook.updateMany(
            {},
            { usedToday: [], $unset: { attemptsToday: "" } }
        );
    },
};

export default notebooks;
