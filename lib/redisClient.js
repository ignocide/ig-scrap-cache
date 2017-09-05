'use strict'
const redis = require('redis')
var RedisClient = function (opts, cb) {
  var NAMESPACE = this.NAMESPACE = 'IGSCRAPE'
  this.KEYS = {
    REQUEST_QUEUE: NAMESPACE + ':REQUEST:QUEUE',
    REQUEST_LODING: NAMESPACE + ':REQUEST:LOADING'
  }
  this.PREFIX = {
    MEDIA: NAMESPACE + ':media',
    CACHE: NAMESPACE + ':cache'
  }
  this._redisClient = redis.createClient(opts)

  this._redisClient.on('connect', function () {
    cb && cb()
  })
}

RedisClient.prototype.getPrefix = function (prefix, type, key) {
  return [prefix, type, key].join(':')
}

RedisClient.prototype.getMeta = function (type, q, cb) {
  var self = this
  this._redisClient.get(self.getPrefix(self.PREFIX.MEDIA, type, q), function (err, result) {
    var exist = !!result
    if (!err && result) {
      try {
        result = JSON.parse(result)
      } catch (err) {
        result = {}
      }
    }

    cb(err, result, exist)
  })
}

RedisClient.prototype.setMeta = function (type, q, media, cacheTime, cb) {
  var self = this
  this._redisClient.setex(this.getPrefix(self.PREFIX.MEDIA, type, q), cacheTime, JSON.stringify(media), cb)
}

RedisClient.prototype.updateMeta = function (opts, cb) {
  var self = this
  var q = opts.q,
    cacheTime = opts.cacheTime,
    aheadTime = opts.aheadTime,
    checkOnly = opts.checkOnly,
    type = opts.type
  var key = this.getPrefix(self.PREFIX.CACHE, type, q)
  this._redisClient.get(key, function (err, updateTime) {
    var needUpdate = false
    if (updateTime == null) {
      needUpdate = true
    } else if ((+new Date()) - updateTime > (cacheTime - aheadTime) * 1000) {
      needUpdate = true
    }

    if (!checkOnly && needUpdate) {
      self._redisClient.setex(key, cacheTime, +new Date())
    }
    cb(needUpdate)
  })
}

RedisClient.prototype.pushQueue = function (type, q, cb) {
  var self = this
  this._redisClient.rpush(self.KEYS.REQUEST_QUEUE, [type, q].join(':'), cb)
}

RedisClient.prototype.popQueue = function (cb) {
  var self = this
  this._redisClient.lpop(self.KEYS.REQUEST_QUEUE, function (err, value) {
    value = value || ''
    value = value.split(':')
    // type,key
    cb(value[0], value[1])
  })
}

RedisClient.prototype.getLoadState = function (cb) {
  this._redisClient.get(this.KEYS.REQUEST_LODING, function (err, result) {
    result = result || false
    result = JSON.parse(result)
    cb(err, result)
  })
}

RedisClient.prototype.setLoadState = function (loading, cb) {
  this._redisClient.set(this.KEYS.REQUEST_LODING, loading, function () {
    cb && cb()
  })
}

RedisClient.prototype.clearCache = function (cb) {
  var client = this._redisClient
  client.keys(this.NAMESPACE + ':*', function (err, keys) {
    client.del(keys, function (err) {
      cb && cb(err)
    })
  })
}
module.exports = RedisClient
