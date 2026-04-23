import { Bot } from "gramio"
import { config } from "./config.ts"
import { composer } from "./plugins/index.ts"
import { startComposer } from "./handlers/start.ts"
import { inlineComposer } from "./handlers/inline.ts"

export const bot = new Bot(config.BOT_TOKEN)
    .extend(composer)
    .extend(startComposer)
    .extend(inlineComposer)
    .onStart(({ info }) => console.log(`✨ Bot ${info.username} was started!`));
