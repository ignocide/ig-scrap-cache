'use strict'
const RedisClient = require('./redisClient')
const images = require('./images')
const crawl = require('./crawling')

var normalizeError = function (err) {
  return {
    status: err.response.status || 500,
    statusText: err.response.statusText || 'Unknown'
  }
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
      self.loadQueue()
    })
  })
}

Instagram.TYPE = {
  TAG: 'tag',
  USER: 'user'
}

// order is important
Instagram.urlRules = {
  tag: {
    rule: /((https?):\/\/)?(www\.)?instagram.com\/explore\/tags\/([\w_]+)/gmi
  },
  user: {
    rule: /((https?):\/\/)?(www\.)?instagram\.com\/([\w._]+)\/?/gmi
  }
}

/**
 * @param {string} [tag] tag name
 * @param {Function} callback
 */
Instagram.prototype.searchByTags = function (tag, cb) {
  crawl.tag(tag).then(function (result) {
    cb(null, result)
  })
  .catch(function (err) {
    cb(normalizeError(err))
  })
}

/**
 * @param {string} [user] user name
 * @param {Function} callback
 */
Instagram.prototype.searchByUser = function (user, cb) {
  crawl.user(user).then(function (result) {
    cb(null, result)
  })
  .catch(function (err) {
    cb(normalizeError(err))
  })
}

/**
 * @param {string} [tag] tag name
 * @param {Function} callback
 */
Instagram.prototype.getMediaByTag = function (tag, cb) {
  var self = this
  var type = Instagram.TYPE.TAG
  var matchs = tag.match(Instagram.urlRules[type].rule)
  if (matchs) {
    tag = matchs[4]
  }

  self.getMedia(type, tag, cb)
}

/**
 * @param {string} [user] or [url] user name or url
 * @param {Function} callback
 */
Instagram.prototype.getMediaByUser = function (user, cb) {
  var self = this
  var type = Instagram.TYPE.USER

  var matchs = user.match(Instagram.urlRules[type].rule)
  if (matchs) {
    user = matchs[4]
  }
  self.getMedia(type, user, cb)
}

/**
 * @param {string} [url] url
 * @param {Function} callback
 */
Instagram.prototype.getMediaByUrl = function (url, cb) {
  var self = this
  var keys = Object.keys(Instagram.urlRules)
  var type, value
  for (let key of keys) {
    value = url.match(Instagram.urlRules[key].rule)
    if (value !== null) {
      type = key
      value = value[4]
      break
    }
  }
  self.getMedia(type, value, cb)
}

Instagram.prototype.getMedia = function (type, q, cb) {
  var self = this
  self._redisClient.getMedia(type, q, function (err, result, exist) {
    if (err) {
      return cb(err)
    }
    if (exist || !self._config.enableFirstTime) {
      result = new images(result)
      cb(err, result)
    } else {
      var func = null

      if (type == Instagram.TYPE.TAG) {
        func = 'searchByTags'
      } else if (type == Instagram.TYPE.USER) {
        func = 'searchByUser'
      } else {
        return cb()
      }

      self[func](q, function (err, result) {
        result = new images(result)
        cb(err, result)
      })
    }
  })

  self.insertQueue(type, q)
}

Instagram.prototype.updateMedia = function (type, q, cb) {
  var self = this
  self._redisClient.updateMedia({
    type: type,
    q: q,
    cacheTime: self._config.cacheTime,
    aheadTime: self._config.aheadTime,
    checkOnly: false
  }, function (needUpdate) {
    if (self._config.force || needUpdate) {
      var func = null
      if (type == Instagram.TYPE.TAG) {
        func = 'searchByTags'
      } else if (type == Instagram.TYPE.USER) {
        func = 'searchByUser'
      } else {
        return cb()
      }
      self[func](q, function (err, list) {
        if (err) {
          return cb(err)
        }
        self._redisClient.setMedia(type, q, list, self._config.cacheTime, cb)
      })
    } else {
      cb()
    }
  })
}

Instagram.prototype.loadQueue = function (cb) {
  var self = this
  self._redisClient.getLoadState(function (err, loading) {
    if (loading) {
      cb && cb()
    } else {
      self._redisClient.setLoadState(true, function () {
        self.loadQueueTask()
      })
    }
  })
}

Instagram.prototype.loadQueueTask = function () {
  var self = this
  self._redisClient.popQueue(function (type, q) {
    if (q) {
      self.updateMedia(type, q, function () {
        self.loadQueueTask()
      })
    } else {
      self._redisClient.setLoadState(false)
    }
  })
}

Instagram.prototype.insertQueue = function (type, q, cb) {
  var self = this
  self._redisClient.updateMedia({
    q: q,
    cacheTime: self._config.cacheTime,
    aheadTime: self._config.aheadTime,
    type: type,
    checkOnly: true
  }, function (needUpdate) {
    if (needUpdate) {
      self._redisClient.pushQueue(type, q, function () {
        self.loadQueue()
      })
    }

    cb && cb()
  })
}

module.exports = Instagram
