// https://stackoverflow.com/questions/8011962/schedule-node-js-job-every-five-minutes

// import * as haikubot from './haikubot/index.js'
// import * as limerickbot from './limerickbot/index.js'

import Bot from './bot.js'
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();


const limerickbot = new Bot({name: "limerickbot"})

await limerickbot.login({
    username: process.env.BSKY_LIMERICKBOT_USERNAME,
    password: process.env.BSKY_LIMERICKBOT_PASSWORD
})

limerickbot.onMention = async function(notif) {
    let prompt = `Write a nonsensical limerick with words that are gibberish`

    // Check to see if it's a reply or a top-level post
    if ('reply' in notif.record) {
        limerickbot.log(`Replying to reply ${notif.uri}`)

        // Extract relevant info about the post
        const parent_thread = await limerickbot.bskyAgent
            .getPostThread({ uri: notif.record.reply.parent.uri, depth: 99 });
        const post_text = parent_thread.data.thread.post.record.text; // limerick inspo
        prompt = `Rewrite this as a limerick in no more than 300 characters:\n\n${post_text}`;

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

        // const mentions_removed = post_text.replace(/@limerickbot\.gar\.lol/g, '');
        prompt = `Your name is @limerick.bot.gar.lol, your job is to respond to `
            + `everything in the form of a limerick. `
            + `The following is an instruction or inspiration for a limerick. `
            + `Create a limerick accordingly.\n\n${notif.record.text}`;
    }

    // Generate the reply and then post it
    const replytext = await limerickbot.getGPT4Completion(prompt)
    limerickbot.postReply(notif, replytext)

    // Like the post we just replied to
    await limerickbot.bskyAgent.like(notif.uri, notif.cid)
}

limerickbot.run_once()





// const minutes = 1;
// const the_interval = minutes * 60 * 1000;

// let getTime = function() {
//   return new Date().toISOString().replace(/T/, ' ').replace(/Z/, '')
// }

// setInterval(function() {
//   console.log('----------------------------------------------------------------')
//   let timestamp = getTime();
//   console.log(`${timestamp} Running bots.`);

//   haikubot.handler()
//   limerickbot.handler()

//   // timestamp = getTime();
//   // console.log(`${timestamp} First bot.`);
//   // setTimeout(function() {
//   //   let timestamp = getTime();
//   //   console.log(`${timestamp} Second bot.`)
//   // }, .1*60*1000);

// }, the_interval);
