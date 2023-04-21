import Bot from './bot.js'
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();

// --- Big line in the log file so we can see when the script restarts

import fs from 'node:fs';
fs.appendFileSync('console.log', "-".repeat(80)+"\n")


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


// --- Logging utilities

import { exec } from 'child_process';
const truncateLogFile = function() {
    // exec('tail -c 10M console.log > console.log', (err, stdout, stderr) => {});
    exec(`tail -c 1M console.log > /tmp/bsky_bots_log_file && rm console.log `
        + `&& mv /tmp/bsky_bots_log_file console.log`, (err, stdout, stderr) => {});
}

const getTime = function() {
    let date = new Date();
    date = new Date(date.getTime() - date.getTimezoneOffset()*60000);
    return date.toISOString().replace(/T/, ' ').replace(/Z/, '')
}

const log = function(str) {
    let logline = ''
    if (str !== undefined) {
        logline = `${getTime()} [main] ${str}`;
    }
    console.log(logline)
    fs.appendFileSync('console.log', logline + "\n")
}


// --- Set up an interval and run them

const seconds = 30;
const the_interval = seconds * 1000;

const run_all = function() {
    log() // extra newline in log file

    try {
        haikubot.run_once()
        limerickbot.run_once()
    } catch(error) {
        log(error)
    }

    truncateLogFile()

    return run_all;
}

setInterval(run_all(), the_interval);
