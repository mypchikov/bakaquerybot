import { Composer } from "gramio";
import { composer } from "../plugins/index.ts";

export const startComposer = new Composer()
	.extend(composer)
	.command(
		"start",
		(context) =>
			context.send(
				[
					"Inline Gelbooru bot is ready.",
					"",
					"Usage:",
					"1. Enable inline mode for the bot in @BotFather with /setinline",
					`2. Type @${context.bot.info?.username ?? "your_bot"} <tags> in any chat`,
					"3. Pick an image from the results",
				].join("\n"),
			),
	);
