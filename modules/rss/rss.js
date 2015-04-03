/** 
 * Module Name: RSS
 * Description: Allows to read RSS feeds
 */
var FeedParser = require('feedparser'), 
    request = require('request'), 
    _ = require('underscore')._;

var rss = function(dbot) {
    this.pollInterval = 120000;
    this.titleCache = [];
    var self = this;

    this.internalAPI = {
        'makeRequest': function(id,feed) {
            dbot.say(feed.server,feed.channel,"RSS: I am making a request for feed "+feed.name+" to "+feed.url+" and I like it.");
            var fid = id,
                req = request(feed.url),
                feedparser = new FeedParser();

            req.on('error', function (error) {
                if(dbot.config.debugMode) {
                    dbot.say(feed.server,feed.channel,"RSS: Request for RSS feed got an error: "+error+" Start self-destruct sequence.");
                }
            });

            req.on('response', function (res) {
                var stream = this;
                if (res.statusCode !== 200){
                    dbot.say(feed.server,feed.channel,"RSS: RSS server returned status code "+res.statusCode+". Bastard.");
                    return;
                }

                stream.pipe(feedparser);
            });

            feedparser.on('error', function(error) {
                if(dbot.config.debugMode) {
                    dbot.say(feed.server,feed.channel,"RSS: Feedparser encountered an error: "+error+";;; Inform administrator!");
                }
            });

            feedparser.on('readable', function() {
                // This is where the action is!
                var stream = this, 
                    meta = this.meta, // **NOTE** the "meta" is always available in the context of the feedparser instance
                    item;

                while (item = stream.read()) {
                    // If the feed does not give a pubdate for this post, ignore it...
                    if(!item.pubdate) {
                        return;
                    }
                    if(dbot.config.debugMode) {
                        dbot.say(feed.server,feed.channel,"RSS: Should post question: Is "+(item.pubdate.getTime()-feed.lastPosted)+" > 0?");
                    }
                    if(item.pubdate.getTime() - feed.lastPosted > 0) {
                        if(item.pubdate.getTime() > feed.newTime) {
                            feed.newTime = item.pubdate.getTime();
                        }
                        var rss = item;
                        if(dbot.config.debugMode) {
                            dbot.say(feed.server,feed.channel,"RSS: I shall post a new link! PERFECT.");
                        }
                        if(!_.include(self.titleCache, rss.title)) {
                            var options = {
                                uri: 'https://www.googleapis.com/urlshortener/v1/url',
                                method: 'POST',
                                json: {
                                    "longUrl": rss.link
                                }
                            };

                            request(options, function (error, response, body) {
                                if (!error && response.statusCode === 200) {
                                    var rString = "["+feed.name+"] ["+rss.title+"] "; 
                                    if(rss.author !== null && !_.isUndefined(rss.categories[0])) {
                                        rString += "[Post by "+rss.author+" in "+rss.categories[0]+"] ";
                                    }
                                    rString += "- "+body.id;
                                    dbot.say(feed.server,feed.channel, rString);
                                } else {
                                    var rString = "["+feed.name+"] ["+rss.title+"] "; 
                                    if(rss.author !== null && !_.isUndefined(rss.categories[0])) {
                                        rString += "[Post by "+rss.author+" in "+rss.categories[0]+"] ";
                                    }
                                    rString += "- "+rss.link;
                                    dbot.say(feed.server,feed.channel, rString);
                                    console.log("RSS: Url shortener request returned error statuscode "+response.statusCode+": "+body.error.message);
                                }
                            });

                            if(self.titleCache.length > 30) {
                                self.titleCache.splice(0, 1); 
                            }
                            self.titleCache.push(rss.title);
                        }
                    }
                }
            });
            feedparser.on('end', function() {
                feed.lastPosted = feed.newTime;
                dbot.db.feeds[fid] = feed;
            });
        }.bind(this),

        'checkFeeds': function() {
            console.log("Checking feeds...");
            if(dbot.db.feeds == null) {
                console.log("No active feeds...");
                return;
            }
            for(var i=0;i<dbot.db.feeds.length;++i) {
                this.internalAPI.makeRequest(i,dbot.db.feeds[i]);
            }
        }.bind(this),

        'reloadFeeds': function() {
            return setInterval(this.internalAPI.checkFeeds, this.pollInterval);
        }.bind(this)
    };

    this.commands = {
        '~addrssfeed': function(event) {
            if(event.params.length < 3) {
                event.reply("GIMME TWO PARAMETERS DUDE");
                return;
            }
            var now = Date.now();
            if(dbot.db.feeds == null)
                dbot.db.feeds = [];
            dbot.db.feeds.push({server:event.server, channel:event.channel.name, name:event.params[1], url:event.params[2], lastPosted: 0, newTime: 0});
            event.reply("Adding RSS feed named "+event.params[1]+" with URL "+event.params[2]);
        },

        '~rsstest': function(event) {
            event.reply("I posted RSS last @ "+this.lastPosted);
            event.reply("Checking feeds manually...");
            this.internalAPI.checkFeeds();
            event.reply("Call got through!");
        },

        '~delrssfeed': function(event) {
            for(var i=0;i<dbot.db.feeds.length;++i) {
                if(dbot.db.feeds[i].server == event.server && dbot.db.feeds[i].channel == event.channel.name && dbot.db.feeds[i].name == event.params[1]) {
                    dbot.db.feeds.splice(i, 1);
                    event.reply("Removed feed "+event.params[1]+" you were looking for...");
                    break;
                }
            }
        }
    };

    this.onLoad = function() {
        this.interval = this.internalAPI.reloadFeeds();
    };

    this.onDestroy = function() {
        clearInterval(this.interval);
    };
};

exports.fetch = function(dbot) {
    return new rss(dbot);
};
