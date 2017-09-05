var IgScrap = require('./index')

var igScrap = new IgScrap({
  redis: {
    port: 6379,
    host: '127.0.0.1'
  },
  config: {
    aheadTime: 50 * 60,
    cacheTime: 10 * 60,
    enableFirstTime: true,
    force: true
  }
})

var log = function (err, result) {
  console.log(err, result)
}

igScrap.getMediaByTag('nodejs!!!!', log)
igScrap.getMediaByTag('nodejs', log)
igScrap.getMediaByUser('zuck', log)
igScrap.getUser('kimdoinjdny', log)

igScrap.searchByUser('loveclairelee', log)
igScrap.searchByUser('imegg', log)

igScrap.getMediaByUrl('https://www.instagram.com/explore/tags/nodejs/', log)
igScrap.getMediaByUrl('https://www.instagram.com/zuck/', log)

igScrap.getMediaByTag('https://www.instagram.com/explore/tags/nodejs/', log)
igScrap.getMediaByUser('https://www.instagram.com/zuck/', log)

igScrap.getMediaByUser('https://Instagram.com/zuck/', log)

