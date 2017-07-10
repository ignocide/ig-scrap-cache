'use strict'
const RedisClient = require('./redisClient')
const images = require('./images')
const crawl = require('./crawling')

var Instagram = function (opts) {
  var self = this

  this._config = {
    cacheTime: 60 * 30,
    aheadTime: 5 * 30,
    force: false,
    enableFirstTime: false
  }

  this.TYPE = {
    TAG: 'tag',
    USER: 'user'
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

Instagram.prototype.searchByTags = function (tag, cb) {
  crawl.tag(tag).then(function (result) {
    cb(null, result)
  })
  .catch(cb)
}

Instagram.prototype.searchByUser = function (user, cb) {
  crawl.user(user).then(function (result) {
    cb(null, result)
  })
  .catch(cb)
}

Instagram.prototype.getMediaByTag = function (tag, cb) {
  var self = this
  var type = self.TYPE.TAG
  self.getMedia(type, tag, cb)
}

Instagram.prototype.getMediaByUser = function (user, cb) {
  var self = this
  var type = self.TYPE.USER
  self.getMedia(type, user, cb)
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

      if (type == self.TYPE.TAG) {
        func = 'searchByTags'
      } else if (type == self.TYPE.USER) {
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
      if (type == self.TYPE.TAG) {
        func = 'searchByTags'
      } else if (type == self.TYPE.USER) {
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
