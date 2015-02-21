var config = require('./config');
var request = require('request');
var procure = require('procure');
var async = require('async');
var rest = require('restler');
var _ = require('lodash');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');
var Form = require('form-data')

// toggle this for production vs. local version.
/*/var base = 'http://decentral.fm/';/*/
var base = 'http://localhost:15005/';/**/
var home = 'http://' + config.service.authority;

procure( base + 'shows/decentralize', function(err, show) {

  // TODO: catch error
  show = JSON.parse( show );
  show.base = base;
  show.home = home;

  var decentralize = new Maki( config );
  var soundcloud = new Soundcloud( config.soundcloud );

  var Show = decentralize.define('Show', {
    attributes: {
      title: { type: String , slug: true },
      slug: { type: String },
      recorded: { type: Date },
      released: { type: Date , default: Date.now , required: true },
      description: { type: String },
      audio: { type: String }
    },
    names: { get: 'item' },
    source: base + 'recordings',
    icon: 'sound'
  });

  var Index = decentralize.define('Index', {
    name: 'Index',
    routes: { query: '/' },
    templates: { query: 'index' },
    requires: {
      'Show': {
        filter: {}
      }
    },
    static: true,
    internal: true
  });

  soundcloud.get('users/decentralyze/tracks', function(err, tracks) {
    
    // TODO: error handling
    tracks = JSON.parse( tracks ).reverse();
    
    async.map( tracks , function(track, done) {
      Show.query({ /* TODO: query by title/slug */ }, function(err, recordings) {
        var episode = _.find( recordings , function( el ) {
          return el.title === track.title;
        });
        if (episode) return done( null , episode );
        
        var streamURL = track.stream_url + '?client_id=' + config.soundcloud.clientID;

        console.log('downloading...')

        var form = new Form();
        form.append( '_show' , show._id );
        form.append( 'title' , track.title );
        form.append( 'released' , Date.parse( track.created_at ) );
        form.append( 'description' , track.description );
        form.append( 'audio', request.get( streamURL ) );
        form.submit( base + 'recordings' , function(err, res) {
          res.resume();
          console.log('ok');
          done();
        });

      });
    }, function(err, results) {
    
      decentralize.start(function() {
        decentralize.app.locals.show = show;
      });
    });
  });
});
