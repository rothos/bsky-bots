import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import oai from "openai";
const { Configuration, OpenAIApi } = oai;
import fs from 'node:fs';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();

const getTime = function() {
    let date = new Date();
    date = new Date(date.getTime() - date.getTimezoneOffset()*60000);
    return date.toISOString().replace(/T/, ' ').replace(/Z/, '')
}

export default class Bot {

    constructor(params) {
        this.name = params.name;
        this.logfile = this.name + ".log"
        this.handle = null;
        this.did;
        this.bskyAgent = null;
        this.openai = null;
        this.bsky_credentials = null;
        this.interval = null;
        this.onFollow = function() {}
        this.onMention = function() {}
        this.onLike = function() {}
        this.onRepost = function() {}
        this.onReply = function() {}
        this.onQuote = function() {}
    }

    log(str) {
        const logline = `${getTime()} [${this.name}] ${str}`;
        console.log(logline)
        fs.appendFileSync(this.logfile, logline + "\n")
    }

    truncateLogFile = function() {
        // exec('tail -c 10M console.log > console.log', (err, stdout, stderr) => {});
        exec(`tail -c 1M ${this.logfile} > /tmp/${this.logfile} && rm ${this.logfile} `
            + `&& mv /tmp/${this.logfile} ${this.logfile}`, (err, stdout, stderr) => {});
    }

    async login(bsky_credentials) {
        this.log("-".repeat(80))
        this.log('Logging into bsky...')
        this.bsky_credentials = bsky_credentials

        try {
            // Log in to Bluesky
            this.bskyAgent = new BskyAgent({
                service: 'https://bsky.social',
                persistSession: (evt, sess) => {
                    // store the session-data for reuse
                    // [how to do this??]
                },
            });

            const response = await this.bskyAgent.login({
                identifier: bsky_credentials.username,
                password: bsky_credentials.password,
            })

            // Save our user details
            this.handle = response.data.handle;
            this.did = response.data.did;

            // Log in to OpenAI
            const configuration = new Configuration({
                organization: process.env.OPENAI_ORG,
                apiKey: process.env.OPENAI_API_KEY,
            });
            this.openai = new OpenAIApi(configuration);

            this.log('Logged in.')

        } catch (error) {
            this.log(`LOGIN ERROR: ${error}`)
        }
    }

    async ensureLogin() {
        if (this.bskyAgent
            && this.bskyAgent.hasOwnProperty("session")
            && this.bskyAgent.session.hasOwnProperty("accessJwt")
            && typeof this.bskyAgent.session.accessJwt === "string"
            && this.bskyAgent.session.accessJwt.length > 0)
        {
            return true
        }

        // We're not logged in
        this.log('Not logged in. Attempting to log in to bsky.')
        try {
            await this.login(this.bsky_credentials)
            this.log('Logged in.')
        } catch (error) {
            this.log('Unable to log in to bsky.')
        }
    }

    async respondToNotifications_main() {
        // Make sure we're logged in
        await this.ensureLogin()

        // First grab a list of notifications
        let all_notifs
        try {
            all_notifs = await this.getNotifications()
        } catch (error) {
            this.log("ERROR: Could not retrieve notifications.")
            this.log(error)
            return
        }

        // Filter for unread ones
        const new_notifs = all_notifs.filter((notif) => {
            return notif.isRead === false;
        });

        // Print out a line to the log detailing the unreads
        const counts = new_notifs.reduce((acc, notif) => {
            if (acc[notif.reason]) {
                acc[notif.reason] += 1
            } else {
                acc[notif.reason] = 1
            }
            return acc
        }, {})

        const counts_text = Object.keys(counts)
            .map(key => `${counts[key]} ${key}s`)

        if (new_notifs.length > 0) {
            this.log(`Found ${new_notifs.length} new notifications: ` +
                `${counts_text.join(', ')}`)
        } else {
            this.log(`No new notifications.`);
            return
        }

        // Mark notifications as read
        try {
            this.markNotificationsAsRead()
        } catch (error) {
            this.log("ERROR: Could not mark notifications as read.")
            this.log(error)
            return
        }

        try {
            await Promise.all(
                new_notifs.map(async (notif) => {
                    switch(notif.reason) {
                        case 'mention':
                            await this.onMention(notif)
                            break;

                        case 'like':
                            await this.onLike(notif)
                            break;

                        case 'follow':
                            await this.onFollow(notif)
                            break;

                        case 'repost':
                            await this.onRepost(notif)
                            break;

                        case 'reply':
                            await this.onReply(notif)
                            break;

                        case 'quote':
                            await this.onQuote(notif)
                            break;

                        default:
                            this.log(`Warning: Unknown ` +
                                `notification reason "${notif.reason}"`)
                    }
                })
            )
        } catch (error) {
            this.log("ERROR while responding to notifications.")
            this.log(error)
            return
        }

        this.log('Completed async responses. Goodbye.')
    }

    // Arrow function because it's a callback for the newInterval function
    respondToNotifications = () => {
        try {
            this.respondToNotifications_main()
        } catch (error) {
            this.log(error)
        }

        this.truncateLogFile()

        return this.respondToNotifications
    }

    newInterval(fn, interval_in_milliseconds) {
        fn() // run it immediately, and then every interval_in_milliseconds
        this.interval = setInterval(fn, interval_in_milliseconds)
    }

    async getNotifications() {
        const response_notifs = await this.bskyAgent.listNotifications();
        const notifs = response_notifs.data.notifications;
        return notifs;
    }

    async markNotificationsAsRead() {
        this.bskyAgent.updateSeenNotifications();
    }

    async post(obj) {
        this.log(`Posting...`)
        await this.bskyAgent.post(obj)
    }

    async postReply(notif, text) {
        this.log(`Posting reply "${text.split("\n")[0]} ..."`)

        let root = notif;
        if ('reply' in notif.record) {
            root = notif.record.reply.root;
        }

        await this.bskyAgent.post({
            text: text,
            reply: {
                parent: {
                    uri: notif.uri,
                    cid: notif.cid,
                },
                root: {
                    uri: root.uri,
                    cid: root.cid,
                },
            },
        });
    }

    async getGPT4Completion(prompt) {
        // return 'test completion'
        const completion = await this.openai.createChatCompletion({
            model: 'gpt-4',
            messages: [
                {
                    role: 'user',
                    content: prompt
                },
            ],
        });
        return completion.data.choices[0].message.content;;
    }

    countAuthorPostsInThread = function (thread, did) {
        var count = 0;

        if (thread.post.author.did === did) {
            count++;
        }

        if (thread.hasOwnProperty('parent')) {
            count += this.countAuthorPostsInThread(thread.parent, did);
        }

        return count;
    }

}
