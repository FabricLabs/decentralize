process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var procure = require('procure');

var Maki = require('maki');
var Soundcloud = require('./Soundcloud');
var Engine = require('./Engine');
var Remote = require('maki-remote');
var WebSocket = require('ws');

var jsonpatch = require('fast-json-patch');

function DECENTRALIZE (config) {
  if (!config) config = require('../config');
  
  var self = this;

  self.config = config;
  self.home = 'https://' + config.service.authority;

  self.source = config.source;
  self.source.authority = self.source.host;
  if (!~[80, 443].indexOf( parseInt(self.source.port) )) {
    self.source.authority += ':' + self.source.port;
  }
  self.source.base = self.source.proto + '://' + self.source.authority;

  self.app = new Maki( config );
  var soundcloud = new Soundcloud( config.soundcloud );

  var Sessions = require('maki-sessions');
  var sessions = new Sessions();

  self.app.use(sessions);

  // setup of various remotes, subservices on another Maki namespace
  var MailPimpSubscription = new Remote('http://localhost:2525/subscriptions');
  var MailPimpTask = new Remote('http://localhost:2525/tasks');

  var Subscription = self.app.define('Subscription', {
    attributes: {
      email: { type: String , required: true , validator: function(value) {
        // see HTML spec: https://html.spec.whatwg.org/multipage/forms.html#valid-e-mail-address
        // this should mirror HTML5's "type=email", as per the above link
        return /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test( value );
      } },
      status: { type: String , enum: ['requested', 'pending', 'validated'], default: 'requested' },
      created: { type: Date , default: Date.now },
    },
    handlers: {
      html: {
        create: function(req, res, next) {
          req.flash('info', 'Successfully subscribed!  Check your inbox for a confirmation.');
          res.redirect('/');
        }
      }
    }
  });

  Subscription.post('create', function(done) {
    var subscription = this;
    MailPimpSubscription.create({
      email: subscription.email,
      // TODO: place in config, or auto-create-and-collect
      _list: '55d490d83e5a3dcf5287129e'
    }, function(err, data) {
      // TODO: retry, error handling, etc.
      if (!data._id) return done('no subscription created');
      Subscription.patch({ _id: subscription._id }, [
        { op: 'replace', path: '/status', value: 'pending' }
      ], function(err) {
        if (err) console.error(err);
        done(err);
      });
    });
  });

  Show  = self.app.define('Show',  require('../resources/Show'));
  Index = self.app.define('Index', require('../resources/Index'));

}

DECENTRALIZE.prototype.start = function (done) {
  var self = this;
  if (!done) done = Function();

  procure( self.source.base + '/shows/decentralize' , function(err, show) {
    if (err || !show) return console.error(err || 'no such show: decentralize');

    try {
      self.config.show = JSON.parse( show );
    } catch (e) {
      console.error(e);
      return done(e);
    }
    
    self.config.show.source = self.source;
    self.config.show.home = self.home;

    console.log('maki starting...');

    self.app.start(function() {
      console.log('maki started!');
      
      self.app.app.locals.show = self.config.show;

      self.app.app.get('/about', function(req, res, next) {
        res.render('about');
      });
      self.app.app.get('/contact', function(req, res, next) {
        res.render('contact');
      });
      self.app.app.post('/contact', function(req, res, next) {
        MailPimpTask.create({
          subject: 'DECENTRALIZE Contact Form',
          recipient: 'eric@self.app.fm',
          sender: req.param('from'),
          content: req.param('message')
        }, function(err, task) {
          req.flash('info', 'Mail sent successfully!  We\'ll get in touch shortly.');
          res.redirect('/');
        });
      });
      self.app.app.get('/team', function(req, res, next) {
        res.render('team');
      });
      self.app.app.get('/subscribe', function(req, res, next) {
        res.render('subscribe');
      });

      // redirect an erroneous lengthy tag
      self.app.app.get('/shows/episode-26-nick-sullivan-on-changetip-and-the-future-of-bitcoin-microtransactions', function(req, res, next) {
        res.redirect( 301 , '/shows/episode-25-nick-sullivan');
      });
      self.app.app.get('/shows/episode-29-susanne-tempelhof-and-dan-metcalf-on-blockchain-applications-and-bitcoin-2-0', function(req, res, next) {
        res.redirect( 301 , '/shows/episode-29-susanne-tempelhof-and-dan-metcalf');
      });

      self.app.app.get('/:somePath', function(req, res, next) {
        Show.get({ slug: req.param('somePath') }, function(err, show) {
          if (show) return res.redirect('/shows/' + show.slug );
          next();
        });
      });
      self.app.app.get('/shows', function(req, res, next) {
        if (req.accepts('application/rss+xml')) {
          return res.redirect('/feed');
        } else {
          return next();
        }
      });
      self.app.app.get('/rss', function(req, res, next) {
        res.redirect( 301 , '/feed' );
      });
      self.app.app.get('/feed', function(req, res, next) {
        Show.query({}, function(err, shows) {
          res.set('Content-Type', 'application/rss+xml');
          res.render('feed', {
            resource: Show,
            collection: shows
          });
        });
      });

      var engine = new Engine( self.config , self.app );

      setInterval(function() {
        //engine.sync();
      }, /*/ 2500 /*/ 1 * 3600 * 1000 /**/ );

      engine.subscribe();
      engine.sync();
      
      return done();

    });

  });
}

module.exports = DECENTRALIZE;
