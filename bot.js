import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import oai from "openai";
const { Configuration, OpenAIApi } = oai;
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();

const getTime = function() {
  return new Date().toISOString().replace(/T/, ' ').replace(/Z/, '')
}

export default class Bot {

    constructor(params) {
        this.name = params.name;
        this.agent = null;
        this.onFollow = function() {}
        this.onMention = function() {}
        this.onLike = function() {}
        this.onRepost = function() {}
        this.onReply = function() {}
        this.onQuote = function() {}
    }

    async login(bsky_credentials) {
        this.log('Logging into bsky...')

        // Log in to Bluesky
        this.agent = new BskyAgent({
            service: 'https://bsky.social',
            persistSession: (evt, sess) => {
                // store the session-data for reuse
                // [how to do this??]
            },
        });
        await this.agent.login({
            identifier: bsky_credentials.username,
            password: bsky_credentials.password,
        });

        // Log in to OpenAI
        const configuration = new Configuration({
            organization: process.env.OPENAI_ORG,
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);

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
        // this.markNotificationsAsRead()

        new_notifs.forEach(notif => {
            switch(notif.reason) {
                case 'mention':
                    this.onMention(notif)
                    break;

                case 'like':
                    this.onLike(notif)
                    break;

                case 'follow':
                    this.onFollow(notif)
                    break;

                case 'repost':
                    this.onRepost(notif)
                    break;

                case 'reply':
                    this.onReply(notif)
                    break;

                case 'quote':
                    this.onQuote(notif)
                    break;

                default:
                    this.log(`Warning: Unknown ` +
                        `notification reason "${notif.reason}"`)
            }
        })

        this.log('Done. Goodbye.')
    }

    async getNotifications() {
        const response_notifs = await this.agent.listNotifications();
        const notifs = response_notifs.data.notifications;
        return notifs;
    }

    async markNotificationsAsRead() {
        this.agent.updateSeenNotifications();
    }

    log(str) {
        console.log(`${getTime()} [${this.name}] ${str}`)
    }
}
