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

limerickbot.onMention = function(notif) {
    // console.log(notif)
    if ('reply' in notif.record) {
        limerickbot.log(`Replying to reply ${notif.uri}`)
    } else {
        limerickbot.log(`Replying to top-level post ${notif.uri}`)
    }   
}


// console.log(await limerickbot.agent.countUnreadNotifications())
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
