var rest = require('restler');

function Remote(url, id) {
  this.url = url;
  this.id = id || '_id';
}

Remote.prototype._get = function(url, cb) {
  var self = this;
  rest.get( this.url + url ).on('complete', function(data) {
    if (!data[ self.id ]) return cb(data);
    return cb(null, data);
  });
};

Remote.prototype._post = function(url, data, cb) {
  var self = this;
  if (typeof data === 'function') {
    cb = data;
    data = {};
  }
  rest.postJson( this.url + url , data, {
    headers: {
      'Accept': 'application/json'
    }
  }).on('complete', function(data) {
    if (!data[ self.id ]) return cb(data);
    return cb(null, data);
  });
};

Remote.prototype.create = function(obj, cb) {
  this._post('', obj, cb);
};

Remote.prototype.query = function(obj, cb) {
  this._get('', cb);
};

Remote.prototype.get = function(id, cb) {
  this._get('/' + id, cb);
};

module.exports = Remote;
