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
  
  function updateFromSoundcloud() {
    soundcloud.get('users/decentralyze/tracks', function(err, tracks) {
      // TODO: error handling
      try {
        tracks = JSON.parse( tracks ).reverse();
      } catch (e) {
        return;
      }
      
      console.log('tracks returned from soundcloud:', tracks.length , err );
      
      Show.query({ /* TODO: query by title/slug */ }, function(err, recordings) {
        async.mapSeries( tracks , function(track, done) {
          var episode = _.find( recordings , function( el ) {
            return el.title === track.title;
          });
          if (episode) return done( null , episode );
          var streamURL = track.stream_url + '?client_id=' + config.soundcloud.clientID;
          var form = new Form();
          form.append( '_show' , show._id );
          form.append( 'title' , track.title );
          form.append( 'released' , Date.parse( track.created_at ) );
          form.append( 'description' , track.description );
          form.append( 'audio', request.get( streamURL ) );
          form.submit({
            method: 'post',
            host: base,
            path: 'recordings' 
          }, function(err, res) {
            res.resume();
            decentralize.resources['Show'].data.push( res.body )
            return done( null , res.body );
          });

        }, function(err, results) {
          if (err) console.error( err );
          if (results && results.length) return console.log('updated some tracks.');
        });
      });
    });
  }

  decentralize.start(function() {
    decentralize.app.locals.show = show;
    
    setInterval(function() {
      console.log( decentralize.resources['Show'].data );
    }, 6 * 3600 * 1000 );
    
  });
});
