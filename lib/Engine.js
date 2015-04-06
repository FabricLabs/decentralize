var async = require('async');
var _ = require('lodash');
var request = require('request');
var jsonpatch = require('fast-json-patch');
var contentDisposition = require('content-disposition');

var WebSocket = require('ws');
var Soundcloud = require('./Soundcloud');
var Form = require('form-data');

var TRY_TIMES = [ 100 , 250 , 2500 , 10000 , 60 * 1000 , 5 * 60 * 1000 , 10 * 60 * 1000 , 60 * 60 * 1000 ];

function Engine( config , decentralize ) {
  this.config = config;
  this.decentralize = decentralize;
  this.soundcloud = new Soundcloud( config.soundcloud );
  this.tries = 0;
};

Engine.prototype.subscribe = function( cb ) {
  var self = this;
  // subscribe to updates to important things.
  // mainly, recordings
  console.log('initializing socket...');
  
  try {
    self.ws = new WebSocket( self.config.source.sockets + self.config.source.authority + '/recordings');
  } catch (e) {
    throw new Error( e );
  }
  
  self.ws.on('error', function(err) {
    console.error( err );
  });
  self.ws.on('open', function() {
    self.tries = 0;
    console.log('socket now open.');
  });
  self.ws.on('close', function() {
    console.log('socket closed wat');
    
    function attemptReconnect() {
      self.ws.removeAllListeners('open');
      self.ws.removeAllListeners('close');
      self.ws.removeAllListeners('error');
      self.ws.removeAllListeners('message');

      delete self.ws;
      
      self.subscribe();
      
      setTimeout( attemptReconnect , TRY_TIMES[ self.tries++ ] );
      
    };
    
    attemptReconnect();
    
  });
  self.ws.on('message', function(data) {
    console.log('DATAGRAM:' , data );
    var msg = JSON.parse( data );
    if (msg.method === 'patch') {
      if (msg.params.channel === '/recordings') {
        jsonpatch.apply( self.decentralize.resources['Show'].data , msg.params.ops );
      }
      
      if (msg.params.channel.match(/\/recordings\/(.*)/)) {
        var recordings = self.decentralize.resources['Show'].data;
        for (var i = 0; i < recordings.length; i++) {
          if (msg.params.channel === '/recordings/' + recordings[ i ].slug ) {
            jsonpatch.apply( recordings[ i ] , msg.params.ops );
          }
        }
      }
      
    }
  });
};

Engine.prototype.sync = function( cb ) {
  if (!cb) var cb = new Function();
  
  var self = this;
  self.soundcloud.get('users/' + self.config.soundcloud.slug + '/tracks', function(err, tracks) {
    if (err) {
      console.log(err);
      return;
    }
    try {
      tracks = JSON.parse( tracks ).reverse();
    } catch (e) {
      console.log(e);
      return;
    }
    Show.query({}, function(err, recordings) {
      async.mapSeries( tracks , function(track, done) {
        var episode = _.find( recordings , function(e) { return e.title === track.title; });
        if (episode) {
          jsonpatch.apply( episode , [
            { op: 'add', path: '/remotes', value: { soundcloud: {} } },
            { op: 'add', path: '/remotes/soundcloud/id', value: track.id },
            { op: 'add', path: '/type', value: 'soundcloud' },
          ]);
          return done( null , episode );
        }
        if (!track.download_url) return console.log('track not downloadable:' , track.title );
        console.log('no episode found on decentral.fm for show: "'+track.title+'"!  initiating upload...');

        if (track.release_year && track.release_month && track.release_day) {
          var releaseDate = [
            track.release_year,
            track.release_month,
            track.release_day
          ].join('-') + ' 15:00:00 +0000';
        }

        var form = new Form();
        form.append( '_show' , self.config.show._id );
        form.append( 'title' , track.title );
        form.append( 'released' , Date.parse( releaseDate || track.created_at ) );
        form.append( 'description' , track.description );
        
        var streamURL = track.download_url + '?client_id=' + self.config.soundcloud.clientID;

        var r = request.get( streamURL );
        r.on('response', function(response) {
          var disposition = contentDisposition.parse( response.headers['content-disposition'] );
          var filename = disposition.parameters.filename;

          form.append( 'media', response , {
            filename: filename,
            contentType: response.headers['content-type']
          });
          form.submit({
            method: 'post',
            protocol: (self.config.source.proto === 'https') ? 'https' : undefined,
            host: self.config.source.host,
            port: self.config.source.port,
            path: '/recordings',
            headers: {
              Accept: 'application/json'
            }
          }, function(err, res) {
            if (err) return done( err );
            
            res.resume();
            console.log('recording submitted', err , res.statusCode );
            return done( null , res.body );
          });
        });

      }, function(err, results) {
        if (err) console.error( err );
        cb();
      });
    });
  });
}

module.exports = Engine;
