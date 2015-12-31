process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var config = require('./config');
var procure = require('procure');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');
var Engine = require('./lib/Engine');
var Remote = require('maki-remote');
var WebSocket = require('ws');

var jsonpatch = require('fast-json-patch');

var home = 'https://' + config.service.authority;

var source = config.source;
source.authority = source.host;
if (!~[80, 443].indexOf( parseInt(source.port) )) {
  source.authority += ':' + source.port;
}
source.base = source.proto + '://' + source.authority;

var decentralize = new Maki( config );
var soundcloud = new Soundcloud( config.soundcloud );

var Sessions = require('maki-sessions');
var sessions = new Sessions();

decentralize.use(sessions);

// setup of various remotes, subservices on another Maki namespace
var MailPimpSubscription = new Remote('http://localhost:2525/subscriptions');
var MailPimpTask = new Remote('http://localhost:2525/tasks');

Show = decentralize.define('Show', {
  attributes: {
    title: { type: String , slug: true },
    slug: { type: String },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String },
    audio: { type: String },
    filename: { type: String },
    // TODO: replace with a sources list.
    youtube: { type: String },
    soundcloud: { type: String },
  },
  names: { get: 'item' },
  source: source.proto + '://' + source.authority + '/recordings',
  icon: 'sound'
});

var Subscription = decentralize.define('Subscription', {
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

Index = decentralize.define('Index', {
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

procure( source.base + '/shows/decentralize' , function(err, show) {
  if (err || !show) return console.error(err || 'no such show: decentralize');

  // TODO: catch error
  config.show = JSON.parse( show );
  config.show.source = source;
  config.show.home = home;

  decentralize.start(function() {
    decentralize.app.locals.show = config.show;

    decentralize.app.get('/about', function(req, res, next) {
      res.render('about');
    });
    decentralize.app.get('/contact', function(req, res, next) {
      res.render('contact');
    });
    decentralize.app.post('/contact', function(req, res, next) {
      MailPimpTask.create({
        subject: 'DECENTRALIZE Contact Form',
        recipient: 'eric@decentralize.fm',
        sender: req.param('from'),
        content: req.param('message')
      }, function(err, task) {
        req.flash('info', 'Mail sent successfully!  We\'ll get in touch shortly.');
        res.redirect('/');
      });
    });
    decentralize.app.get('/team', function(req, res, next) {
      res.render('team');
    });
    decentralize.app.get('/subscribe', function(req, res, next) {
      res.render('subscribe');
    });

    // redirect an erroneous lengthy tag
    decentralize.app.get('/shows/episode-26-nick-sullivan-on-changetip-and-the-future-of-bitcoin-microtransactions', function(req, res, next) {
      res.redirect( 301 , '/shows/episode-25-nick-sullivan');
    });
    decentralize.app.get('/shows/episode-29-susanne-tempelhof-and-dan-metcalf-on-blockchain-applications-and-bitcoin-2-0', function(req, res, next) {
      res.redirect( 301 , '/shows/episode-29-susanne-tempelhof-and-dan-metcalf');
    });

    decentralize.app.get('/:somePath', function(req, res, next) {
      Show.get({ slug: req.param('somePath') }, function(err, show) {
        if (show) return res.redirect('/shows/' + show.slug );
        next();
      });
    });
    decentralize.app.get('/shows', function(req, res, next) {
      if (req.accepts('application/rss+xml')) {
        return res.redirect('/feed');
      } else {
        return next();
      }
    });
    decentralize.app.get('/rss', function(req, res, next) {
      res.redirect( 301 , '/feed' );
    });
    decentralize.app.get('/feed', function(req, res, next) {
      Show.query({}, function(err, shows) {
        res.set('Content-Type', 'application/rss+xml');
        res.render('feed', {
          resource: Show,
          collection: shows
        });
      });
    });

    var engine = new Engine( config , decentralize );

    setInterval(function() {
      //engine.sync();
    }, /*/ 2500 /*/ 1 * 3600 * 1000 /**/ );

    engine.subscribe();
    engine.sync();

  });

});
