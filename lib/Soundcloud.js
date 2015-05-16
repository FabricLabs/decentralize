var procure = require('procure');
var qs = require('querystring');

function Soundcloud( config ) {
  this.base = 'https://api.soundcloud.com/';
  this.clientID = config.clientID;
}

Soundcloud.prototype.get = function(path, opts, done) {
  var self = this;

  if (typeof opts === 'function') {
    var done = opts;
    var opts = {};
  }

  opts.client_id = self.clientID;

  if (!done) var done = new Function();

  procure( self.base + path + '?' + qs.stringify(opts) , done );

};

module.exports = Soundcloud;
