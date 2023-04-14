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
        this.onFollow = function() {}
        this.onMention = function() {}
        this.onLike = function() {}
        this.onRepost = function() {}
        this.onReply = function() {}
        this.onQuote = function() {}
        this.agent = null;
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
        const notifs = await this.getNotifications()

        notifs.forEach(notif => {
            this.log(`New ${notif.reason}`)

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
                    this.log(`Unknown notification reason "${notif.reason}"`)
            }
        })

        this.log('Done. Goodbye.')
    }

    async getNotifications() {
        const response_notifs = await this.agent.listNotifications();
        const notifs = response_notifs.data.notifications;
        return notifs;
    }

    log(str) {
        console.log(`${getTime()} [${this.name}] ${str}`)
    }
}
