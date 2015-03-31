var async = require('async');
var _ = require('lodash');
var request = require('request');
var jsonpatch = require('fast-json-patch');
var contentDisposition = require('content-disposition');

var Soundcloud = require('./Soundcloud');
var Form = require('form-data');

function Engine( config ) {
  this.config = config;
  this.soundcloud = new Soundcloud( config.soundcloud );
}

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
