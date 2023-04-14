import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import oai from "openai";
const { Configuration, OpenAIApi } = oai;
import fs from 'node:fs';
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();

const getTime = function() {
  return new Date().toISOString().replace(/T/, ' ').replace(/Z/, '')
}

export default class Bot {

    constructor(params) {
        this.name = params.name;
        this.handle = null;
        this.did;
        this.bskyAgent = null;
        this.openai = null;
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
        fs.appendFileSync('console.log', logline + "\n")
    }

    async login(bsky_credentials) {
        this.log('Logging into bsky...')

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
    }

    async run_once() {
        // First grab a list of notifications
        const all_notifs = await this.getNotifications()

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

        this.log(`Found ${new_notifs.length} new notifications: ` +
            `${counts_text.join(', ')}`)

        // Mark notifications as read
        this.markNotificationsAsRead()

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

        this.log('Completed async responses. Goodbye.')
    }
        

    async getNotifications() {
        const response_notifs = await this.bskyAgent.listNotifications();
        const notifs = response_notifs.data.notifications;
        return notifs;
    }

    async markNotificationsAsRead() {
        this.bskyAgent.updateSeenNotifications();
    }

    async postReply(notif, text) {
        this.log(`Posting reply "${text.split("\n")[0]}..."`)

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
