import Bot from './bot.js'
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();


// --- This is the main logic for the limerick bot and the haiku bot

const replyGuyBotLogicForOnMention = function(bot, params) {
    return async function(bot, params, notif) {
        let prompt = "";

        // Check to see if it's a reply or a top-level post
        if ('reply' in notif.record) {
            bot.log(`Replying to reply ${notif.uri}`)

            // Extract relevant info about the post
            const parent_thread = await bot.bskyAgent
                .getPostThread({ uri: notif.record.reply.parent.uri, depth: 99 });
            const post_text = parent_thread.data.thread.post.record.text; // limerick inspo
            prompt = params.replyPrompt + post_text;

            // Count how many times we've already replied in this thread
            const n_replies = bot
                .countAuthorPostsInThread(parent_thread.data.thread, bot.did);

            // Don't respond if we've already replied 5 or more times in this thread
            if (n_replies >= 5) {
                // Like the post we just replied to
                await bot.bskyAgent.like(notif.uri, notif.cid)
                // But don't reply
                return;
            }
        } else {
            bot.log(`Replying to top-level post ${notif.uri}`)
            prompt = params.topLevelPrompt + notif.record.text;
        }

        // Generate the reply and then post it
        const replytext = await bot.getGPT4Completion(prompt)
        await bot.postReply(notif, replytext)

        // Like the post we just replied to
        await bot.bskyAgent.like(notif.uri, notif.cid)
    }.bind(null, bot, params)
}


// --- Set up the limerick bot

const limerickbot = new Bot({name: "limerickbot"})
await limerickbot.login({
    username: process.env.BSKY_LIMERICKBOT_USERNAME,
    password: process.env.BSKY_LIMERICKBOT_PASSWORD
})
const limerick_prompt = `Your name is @limerick.bot.gar.lol, your job is to respond to `
    + `everything in the form of a limerick. `
    + `The following is an instruction or inspiration for a limerick. `
    + `Create a limerick accordingly.\n\n`
limerickbot.onMention = replyGuyBotLogicForOnMention(limerickbot, {
    // topLevelPrompt: `Rewrite this as a limerick in no more than 300 characters:\n\n`,
    topLevelPrompt: limerick_prompt,
    replyPrompt: limerick_prompt
})


// --- Set up the haiku bot

const haikubot = new Bot({name: "haikubot"})
await haikubot.login({
    username: process.env.BSKY_HAIKUBOT_USERNAME,
    password: process.env.BSKY_HAIKUBOT_PASSWORD
})
const haiku_prompt = `Your name is @haiku.bot.gar.lol, your job is to respond to `
    + `everything in the form of a haiku. `
    + `The following is an instruction or inspiration for a haiku. `
    + `Create a haiku accordingly.\n\n`
haikubot.onMention = replyGuyBotLogicForOnMention(haikubot, {
    topLevelPrompt: haiku_prompt,
    replyPrompt: haiku_prompt
})


// --- Set up the opulent joy bot

// // Authenticate via OAuth
// var tumblr = require('tumblr.js');
// var client = tumblr.createClient({
//   consumer_key: process.env.TUMBLR_CONSUMER_KEY,
//   consumer_secret: process.env.TUMBLR_CONSUMER_SECRET,
//   token: process.env.TUMBLR_OAUTH_TOKEN,
//   token_secret: process.env.TUMBLR_OAUTH_SECRET'
// });

// // Make the request
// client.blogPosts('opulentjoy.tumblr.com',
//     { type: 'photo', limit: 20, offset: 0 },
//     function (err, data) {
//         // ...
// });

// const opulentjoybot = new Bot({name: "opulentjoybot"})
// await opulentjoybot.login({
//     username: process.env.BSKY_OPULENTJOYBOT_USERNAME,
//     password: process.env.BSKY_OPULENTJOYBOT_PASSWORD
// })
// const joybotrun = async function() {
//     return
// }


// --- Set intervals and run them

// Check and respond to notifs every 30 seconds
haikubot.newInterval(haikubot.respondToNotifications, 30 * 1000)
limerickbot.newInterval(limerickbot.respondToNotifications, 30 * 1000)

// Post something once per day
// opulentjoybot.newInterval(joybotrun, 24 * 60 * 60 * 1000)
