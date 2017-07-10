# instagram-tag-image  
----  
  
search media using tag name, and cache that using redis

## initial  

```javascript
var InstagarmTagImage = require('instagram-tag-image')

var instagarmTagImage = new InstagarmTagImage({
  redis: {  
    //redis options
    port: 6379,
    host: '127.0.0.1'
  },
  config: {
    //optional, defaults
    force: false,
    cacheTime: 60*30,//30mins
    enableFirstTime: false
  }
})
```

### CONFIGS  

#### redis 

* [node-redis site](https://github.com/NodeRedis/node_redis)

#### config  

| config    | required  | etc     | default |
|:----------|:----------|:--------|:-------|
| force     | false     | force update, ignore cache| false|
| cacheTime | false     | cached time | 30*60|
| aheadTime | false     | enable caching time ahead of cached time | 5*60|
| enableFirstTime | false | enable a loading at first time | false|

## useage  

### search media by tags

```javascript
instagarmTagImage.getMedia(tag_name, function (err, result) {
// result.thumbnails()
// result.standard()
//result
})
```

# warning  

In case of first time in search by tag, return empty array, use enableFirstTime option
