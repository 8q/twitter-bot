require('dotenv').config();
const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo");
const Twitter = require('twitter');
const twitterClient = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_SECRET_TOKEN,
});


const getMentionTimeLine = async () => {
    return twitterClient.get('statuses/mentions_timeline', {
        count: 10,
        include_entities: false,
    });
}

async function main(event) {
    const lastRun = moment(event.time).add(-10, 'm').unix();
    const mentions = (await getMentionTimeLine())
        .filter(e =>
            moment(e.created_at, "ddd MMM D HH:mm:ss ZZ YYYY").unix() > lastRun
            && e.in_reply_to_status_id_str === null)
        .map(e => {
            return {
                screenName: e.user.screen_name,
                statusId: e.id_str,
            };
        });

    const statuses = mentions.map(e => `https://twitter.com/${e.screenName}/status/${e.statusId}`);

    for (let status of statuses.reverse()) {
        const result = await twitterClient.post('statuses/update', { status: status });
        console.log(`status_id: ${result.id_str}`);
    }
}


exports.handler = async (event) => {
    await main(event);
}


// main({ time: '2019-05-24T14:50:00Z' }).then();
