var procure = require('procure');

function Soundcloud( config ) {
  this.base = 'https://api.soundcloud.com/';
  this.clientID = config.clientID;
}

Soundcloud.prototype.get = function( path , done ) {
  var self = this;
  if (!done) var done = new Function();
  
  procure( self.base + path + '?client_id=' + self.clientID , done );

};

module.exports = Soundcloud;
