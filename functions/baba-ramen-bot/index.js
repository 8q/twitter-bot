require('dotenv').config()
const { JSDOM } = require("jsdom")
const rp = require('request-promise')
const fs = require('fs')
const path = require('path')
const Twitter = require('twitter');
const twitterClient = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_SECRET_TOKEN,
});


const generateTabelogRamenListURL1 = (pageNumber) => `https://tabelog.com/tokyo/A1305/A130503/R5779/rstLst/ramen/${pageNumber}/?LstRange=SB`


const generateTabelogRamenListURL2 = (pageNumber) => `https://tabelog.com/tokyo/A1305/A130504/R10705/rstLst/ramen/${pageNumber}/?LstRange=SB`


const generateTabelogRamenListURL3 = (pageNumber) => `https://tabelog.com/tokyo/A1305/A130504/R10706/rstLst/ramen/${pageNumber}/?LstRange=SB`


const generateGoogleMapURL = (locationStr) => `https://maps.google.co.jp/maps?q=${locationStr}`


const downloadImageFromURL = async (url, dir, name = '') => rp({ url: url, encoding: null }).then(body => new Promise((resolve, reject) => {
    const filepath = name ? path.join(dir, name) : path.join(dir, path.basename(url))
    fs.writeFile(filepath, body, (err) => {
        if (err) reject(err)
        else resolve(filepath)
    })
}))


const main = async (event) => {
    const tabelogUrlSet = new Set()

    for(const generateTabelogRamenListURL of [generateTabelogRamenListURL1, generateTabelogRamenListURL2, generateTabelogRamenListURL3]) {
        for (let page = 1; ; page++) {
            const body = await rp(generateTabelogRamenListURL(page))
            const dom = new JSDOM(body)
            const liElements = dom.window.document.querySelectorAll("ul.rstlist-info > li.list-rst")
    
            if(liElements.length <= 0) 
                break
    
            for (const liElement of liElements) {
                tabelogUrlSet.add(liElement.getAttribute("data-detail-url"))
            }
        }
    }

    const tabelogUrls = Array.from(tabelogUrlSet)

    if (tabelogUrls.length <= 0) {
        console.log(`'tabelogUrls' is empty.`)
        return
    }

    const tabelogUrl = tabelogUrls[Math.floor(Math.random() * tabelogUrls.length)]
    const body = await rp(tabelogUrl)
    const dom = new JSDOM(body)

    const shopNameElement = dom.window.document.querySelector("h2.display-name > span")
    const shopName = shopNameElement.textContent

    const imgUrlElements = dom.window.document.querySelectorAll("p.rstdtl-top-postphoto__photo > a")
    const imgUrls = Array.from(imgUrlElements, e => e.getAttribute("href")).slice(0, 3)

    const mapImgUrlElement = dom.window.document.querySelector('div.rstinfo-table__map > a > img')
    const mapImgUrl = mapImgUrlElement.getAttribute("data-original").replace(/&amp;/g, '&')

    const shopLocationURL = generateGoogleMapURL(mapImgUrl.match(/^.*center=([\.,0-9]+).*$/)[1])

    const filepaths = await Promise.all(
        imgUrls.map(url => downloadImageFromURL(url, '/tmp'))
            .concat(downloadImageFromURL(mapImgUrl, '/tmp', 'map.png')))

    const mediaIds = []
    for(const filepath of filepaths) {
        const data = fs.readFileSync(filepath)
        const media = await twitterClient.post('media/upload', { media: data })
        mediaIds.push(media.media_id_string)
    }

    const status = `${shopName}

食べログ
${tabelogUrl}

Google Map
${shopLocationURL}
`

    const result = await twitterClient.post('statuses/update', {
        status: status,
        media_ids: mediaIds.join(",")
    })

    console.log(`status id: ${result.id_str}`)
}


exports.handler = async (event) => {
    await main(event)
}


// main({}).then()
