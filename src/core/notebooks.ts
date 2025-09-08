import { Client } from "discord.js";
import access from "./access";
import Notebook from "../models/notebookts";
import Player from "../models/playerts";

let client: Client;

const notebooks = {

    init: function(newClient: Client) {
        client = newClient;
    },

    // if guild is not a notebook yet, this function creates a new notebook and sets the current and original owner to owner.
    // if guild is already a notebook, the notebook's current owner is updated to the next owner.
    // grants and revokes guild access as necessary.
    // if temporary is true, then instead of current owner being changed, temporary owner is changed. notebooks with temporary owners
    // are sent back to their current owners when the next day begins even if the temporary owner died with it.
    async set(guildId: string, ownerId: string, temporary?: boolean): Promise<void> {
        const existingBook = await Notebook.findOne({ guildId });

        if (existingBook) {
            const currentHolder =
                existingBook.temporaryOwner ?? existingBook.currentOwner;
            const newHolder = ownerId;

            // if the current holder and new holder are the same, do nothing
            if (currentHolder === newHolder) return;

            // if temporary, change the temporary owner field, otherwise, change current owner
            if (temporary) {
                await Notebook.updateOne(
                    { _id: existingBook._id },
                    { $set: { temporaryOwner: ownerId } }
                );
            } else {
                if (existingBook.currentOwner !== ownerId)
                    await Notebook.updateOne(
                        { _id: existingBook._id },
                        { $set: { currentOwner: ownerId } }
                    );
            }

            // if the person holding the notebook, changed, revoke access from the old and grant to the new.
            if (newHolder !== currentHolder) {
                await access.revoke(currentHolder, guildId);
                await access.grant(newHolder, guildId);
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
        });

        await access.grant(ownerId, guildId);
    },

    async addRestrictor(userId: string, reason: string): Promise<void> {
        const playerData = await Player.findOne({ userId });
        if (!playerData) return;
    
        playerData.notebookRestrictors.set(reason, true);
        await playerData.save();
    },

    async removeRestrictor(userId: string, reason: string): Promise<void> {
        const playerData = await Player.findOne({ userId });
        if (!playerData) return;

        playerData.notebookRestrictors.delete(reason);
        await playerData.save();
    },
    
};

export default notebooks;