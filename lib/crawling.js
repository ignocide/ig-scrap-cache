'use strict'

const axios = require('axios')
const dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/

var parse = function (string) {
  var json = null
  try {
    var dataString = string.match(dataExp)[1]
    json = JSON.parse(dataString)
  } catch (err) {
    throw err
  }
  return json
}

var normalize = function (arr) {
  var fileds = [ 'id', 'demenstions', 'owner', 'thumbnail_src', 'code', 'date', 'display_src', 'caption']
  var list = []
  for (let origin of arr) {
    var item = {}
    item.comments = origin.comments.count
    item.likes = origin.likes.count
    for (let field of fileds) {
      item[field] = origin[field]
    }

    list.push(item)
  }
  return list
}

exports.tag = function (tag) {
  var url = 'https://www.instagram.com/explore/tags/' + encodeURIComponent(tag)
  return axios.get(url)
  .then(function (res) {
    var json = parse(res.data)

    return Promise.resolve(normalize(json.entry_data.TagPage[0].tag.media.nodes))
  })
}

exports.user = function (user) {
  var url = 'https://www.instagram.com/' + user
  return axios.get(url)
  .then(function (res) {
    var json = parse(res.data)

    return Promise.resolve(normalize(json.entry_data.ProfilePage[0].user.media.nodes))
  })
}
