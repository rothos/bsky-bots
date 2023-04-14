import Bot from './bot.js'
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();


// --- This is the main logic for the limerick bot and the haiku bot

const replyGuyBotLogicForOnMention = function(bot, params) {
    return async function(notif) {
        let prompt = "";

        // Check to see if it's a reply or a top-level post
        if ('reply' in notif.record) {
            limerickbot.log(`Replying to reply ${notif.uri}`)

            // Extract relevant info about the post
            const parent_thread = await limerickbot.bskyAgent
                .getPostThread({ uri: notif.record.reply.parent.uri, depth: 99 });
            const post_text = parent_thread.data.thread.post.record.text; // limerick inspo
            prompt = params.replyPrompt + post_text;

            // Count how many times we've already replied in this thread
            const n_replies = limerickbot
                .countAuthorPostsInThread(parent_thread.data.thread, limerickbot.did);

            // Don't respond if we've already replied 5 or more times in this thread
            if (n_replies >= 5) {
                // Like the post we just replied to
                await limerickbot.bskyAgent.like(notif.uri, notif.cid)
                // But don't reply
                return;
            }
        } else {
            limerickbot.log(`Replying to top-level post ${notif.uri}`)
            prompt = params.topLevelPrompt + notif.record.text;
        }

        // Generate the reply and then post it
        const replytext = await limerickbot.getGPT4Completion(prompt)
        await limerickbot.postReply(notif, replytext)

        // Like the post we just replied to
        await limerickbot.bskyAgent.like(notif.uri, notif.cid)
    }
}



// --- Set up the limerick bot

const limerickbot = new Bot({name: "limerickbot"})
await limerickbot.login({
    username: process.env.BSKY_LIMERICKBOT_USERNAME,
    password: process.env.BSKY_LIMERICKBOT_PASSWORD
})
limerickbot.onMention = replyGuyBotLogicForOnMention(limerickbot, {
    // topLevelPrompt: `Rewrite this as a limerick in no more than 300 characters:\n\n`,
    topLevelPrompt: `Your name is @limerick.bot.gar.lol, your job is to respond to `
                + `everything in the form of a limerick. `
                + `The following is an instruction or inspiration for a limerick. `
                + `Create a limerick accordingly.\n\n`,
    replyPrompt: `Your name is @limerick.bot.gar.lol, your job is to respond to `
                + `everything in the form of a limerick. `
                + `The following is an instruction or inspiration for a limerick. `
                + `Create a limerick accordingly.\n\n`,
})


// --- Set up the haiku bot

const haikubot = new Bot({name: "haikubot"})
await haikubot.login({
    username: process.env.BSKY_HAIKUBOT_USERNAME,
    password: process.env.BSKY_HAIKUBOT_PASSWORD
})
haikubot.onMention = replyGuyBotLogicForOnMention(haikubot, {
    topLevelPrompt: `Your name is @haiku.bot.gar.lol, your job is to respond to `
                    + `everything in the form of a haiku. `
                    + `The following is an instruction or inspiration for a haiku. `
                    + `Create a haiku accordingly.\n\n`,
    replyPrompt: `Your name is @haiku.bot.gar.lol, your job is to respond to `
                    + `everything in the form of a haiku. `
                    + `The following is an instruction or inspiration for a haiku. `
                    + `Create a haiku accordingly.\n\n`,
})


// --- Set up an interval and run them

const minutes = 1;
const the_interval = minutes * 60 * 1000;

// The funny way this function is set up -- how it returns itself --
// is purely so that run_all will run once before the setInterval
const run_all = function() {
    console.log() // extra newline in the log

    haikubot.run_once()
    limerickbot.run_once()

    return run_all;
}

setInterval(run_all(), the_interval);
