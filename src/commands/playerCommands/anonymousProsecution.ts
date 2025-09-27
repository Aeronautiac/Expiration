// const { SlashCommandBuilder } = require("discord.js");
// const game = require("../../game");

// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName("anonymousprosecution")
//         .setDescription("As L, you are allowed to anonymously prosecute one person ever.")
//         .addUserOption((option) =>
//             option
//                 .setName("target")
//                 .setDescription(
//                     "Who do you want to anonymously prosecute?"
//                 )
//                 .setRequired(true)
//         ),
//     async execute(interaction) {
//         await interaction.deferReply({
//             ephemeral: true,
//         });

//         const result = await game.civilianArrest(interaction);

//         if (result !== true) {
//             await interaction.editReply({
//                 content: result,
//                 ephemeral: true,
//             });
//         } else {
//             await interaction.editReply({
//                 content: "Success.",
//                 ephemeral: true,
//             });
//         }
//     },
// };
