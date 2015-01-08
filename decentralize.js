var config = require('./config');
var procure = require('procure');
var async = require('async');
var rest = require('restler');
var _ = require('lodash');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');

// toggle this for production vs. local version.
/*/var base = 'http://decentral.fm/';/*/
var base = 'http://localhost:15005/';/**/

procure( base + 'shows/decentralize', function(err, show) {

  // TODO: catch error
  show = JSON.parse( show );

  var decentralize = new Maki( config );
  var soundcloud = new Soundcloud( config.soundcloud );

  var Recording = decentralize.define('Recording', {
    attributes: {
      title: { type: String },
      recorded: { type: Date },
      released: { type: Date , default: Date.now , required: true },
      description: { type: String }
    },
    source: base + 'recordings',
    icon: 'sound'
  });

  var Index = decentralize.define('Index', {
    name: 'Index',
    routes: { query: '/' },
    templates: { query: 'index' },
    requires: {
      'Recording': {
        filter: {} 
      }
    },
    static: true,
    internal: true
  });
  
  soundcloud.get('users/decentralyze/tracks', function(err, tracks) {
    tracks = JSON.parse( tracks ).reverse();
    
    async.map( tracks , function(track, done) {
      Recording.query({ /* TODO: query by title/slug */ }, function(err, recordings) {
        var episode = _.find( recordings , function( el ) {
          return el.title === track.title;
        });
        if (episode) return done( null , episode );

        rest.post( base + 'recordings', {
          //multipart: true,
          headers: {
            'Accept': 'application/json'
          },
          data: {
            '_show': show._id,
            title: track.title,
            released: Date.parse( track.created_at ),
            description: track.description
            //audio: rest.file('')
          }
        }).on('complete', function(data) {
          console.log('done!' , data );
          done( null , data );
        });
      
      });
    }, function(err, results) {
    
      decentralize.start();

    });
  });
});
