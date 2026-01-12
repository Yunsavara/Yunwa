/**
 * Tagall command - Mention all members in a group
 * Usage: !tagall [message]
 * Examples:
 *   !tagall
 *   !tagall Ada pengumuman penting!
 */
module.exports = {
    name: "tagall",
    description: "Mention all members in a group",
    category: "group",

    async execute(yunwa, msg, sender, pushname, args = []) {
        try {
            // Check if message is from a group
            if (!sender.endsWith("@g.us")) {
                await yunwa.sendMessage(sender, {
                    text: "❌ This command can only be used in groups!",
                });
                return;
            }

            await yunwa.sendPresenceUpdate("composing", sender);

            // Get group metadata
            const groupMetadata = await yunwa.groupMetadata(sender);
            const participants = groupMetadata.participants;

            // Filter out bots and get only real users
            const members = participants.filter(
                (participant) => !participant.id.startsWith("0"),
            );

            if (members.length === 0) {
                await yunwa.sendMessage(sender, {
                    text: "❌ No members found in this group!",
                });
                return;
            }

            // Get custom message or use default
            const customMessage = args.join(" ").trim();
            const message = customMessage
                ? `📢 *${customMessage}*\n\n`
                : `📢 *Attention Everyone!*\n\n`;

            // Create mentions array
            const mentions = members.map((participant) => participant.id);

            // Create tag text
            const tagText = members
                .map(
                    (participant, index) =>
                        `${index + 1}. @${participant.id.split("@")[0]}`,
                )
                .join("\n");

            const fullMessage = `${message}${tagText}\n\n_Total: ${members.length} members_`;

            // Send message with mentions
            await yunwa.sendMessage(sender, {
                text: fullMessage,
                mentions: mentions,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in tagall command:", error);
            await yunwa.sendMessage(sender, {
                text: `❌ ${error.message || "Error occurred while tagging members"}\n\n💡 This command only works in groups!`,
            });
        }
    },
};
