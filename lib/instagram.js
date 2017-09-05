'use strict'
const RedisClient = require('./redisClient')
const crawl = require('./crawler')
const Media = crawl.Media
const User = crawl.User
const urlParser = crawl.urlParser

const TYPE = {
  TAG: 'tag',
  USER: 'user'
}

var mediaCallback = function (callback) {
  return function (err, result) {
    if (err) {
      return callback(err)
    }
    var media = []

    try {
      media = result.media
    } catch (err) {
    }
    callback(err, new Media(media))
  }
}

var typeToFunc = function (type) {
  var func = null
  if (type == TYPE.TAG) {
    func = 'searchByTags'
  } else if (type == TYPE.USER) {
    func = 'searchByUser'
  }
  return func
}

var Instagram = function (opts) {
  var self = this

  this._config = {
    cacheTime: 60 * 30,
    aheadTime: 5 * 30,
    force: false,
    enableFirstTime: false
  }

  // redis default config
  this._redisConfig = {}

  this._redisClient = null

  if (opts.config) {
    const configOpt = ['cacheTime', 'force', 'enableFirstTime', 'aheadTime']
    for (let key of configOpt) {
      if (opts.config[key] !== undefined) {
        this._config[key] = opts.config[key]
      }
    }
  }

  this._redisConfig = opts.redis
  this._redisClient = new RedisClient(this._redisConfig, function () {
    self._redisClient.setLoadState(false, function () {
      self._loadQueue()
    })
  })
}

/**
 * @param {string} [tag] tag name
 * @param {Function} callback
 */
Instagram.prototype.searchByTags = function (tag, cb) {
  crawl.tag(tag, cb)
}

/**
 * @param {string} [user] user name
 * @param {Function} callback
 */
Instagram.prototype.searchByUser = function (user, cb) {
  crawl.user(user, cb)
}

/**
 * @param {string} [tag] tag name
 * @param {Function} callback
 */
Instagram.prototype.getMediaByTag = function (tag, cb) {
  var self = this
  var type = TYPE.TAG
  tag = urlParser.tag(tag)
  self.getMeta(type, tag, mediaCallback(cb))
}

/**
 * @param {string} [user] or [url] user name or url
 * @param {Function} callback
 */
Instagram.prototype.getMediaByUser = function (user, cb) {
  var self = this
  var type = TYPE.USER

  user = urlParser.user(type, user)
  self.getMeta(type, user, mediaCallback(cb))
}

/**
 * @param {string} [url] url
 * @param {Function} callback
 */
Instagram.prototype.getMediaByUrl = function (url, cb) {
  var self = this
  var keys = ['tag', 'user']
  var type, value

  var parsed = urlParser.tag(url)

  // if parse success
  if (parsed !== url) {
    type = 'tag'
    value = parsed
  } else {
    type = 'user'
    value = urlParser.user(url)
  }
  self.getMeta(type, value, mediaCallback(cb))
}

/**
 * @param {string} [user] or [url] user name or url
 * @param {Function} callback
 */
Instagram.prototype.getUser = function (user, cb) {
  var self = this
  var type = TYPE.USER

  user = urlParser.parse(type, user)
  self.getMeta(type, user, cb)
}

Instagram.prototype.getMeta = function (type, q, cb) {
  var self = this
  self._redisClient.getMeta(type, q, function (err, result, exist) {
    if (err) {
      return cb(err)
    }
    if (exist || !self._config.enableFirstTime) {
      cb(err, result)
    } else {
      var func = typeToFunc(type)

      if (!func) {
        return cb(null, [])
      }

      return self[func](q, cb)
    }
  })

  self._insertQueue(type, q)
}

Instagram.prototype._updateMeta = function (type, q, cb) {
  var self = this
  self._redisClient.updateMeta({
    type: type,
    q: q,
    cacheTime: self._config.cacheTime,
    aheadTime: self._config.aheadTime,
    checkOnly: false
  }, function (needUpdate) {
    if (self._config.force || needUpdate) {
      var func = typeToFunc(type)

      if (!func) {
        return cb()
      }
      self[func](q, function (err, result) {
        if (err) {
          return cb(err)
        }
        self._redisClient.setMeta(type, q, result, self._config.cacheTime, cb)
      })
    } else {
      cb()
    }
  })
}

Instagram.prototype._loadQueue = function (cb) {
  var self = this
  self._redisClient.getLoadState(function (err, loading) {
    if (loading) {
      cb && cb()
    } else {
      self._redisClient.setLoadState(true, function () {
        self._loadQueueTask()
      })
    }
  })
}

Instagram.prototype._loadQueueTask = function () {
  var self = this
  self._redisClient.popQueue(function (type, q) {
    if (q) {
      self._updateMeta(type, q, function () {
        self._loadQueueTask()
      })
    } else {
      self._redisClient.setLoadState(false)
    }
  })
}

Instagram.prototype._insertQueue = function (type, q, cb) {
  var self = this
  self._redisClient.updateMeta({
    q: q,
    cacheTime: self._config.cacheTime,
    aheadTime: self._config.aheadTime,
    type: type,
    checkOnly: true
  }, function (needUpdate) {
    if (needUpdate) {
      self._redisClient.pushQueue(type, q, function () {
        self._loadQueue()
      })
    }

    cb && cb()
  })
}

module.exports = Instagram
