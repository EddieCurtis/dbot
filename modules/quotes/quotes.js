var _ = require('underscore')._;

var quotes = function(dbot) {
    dbot.sessionData.rmCache = [];
    this.quotes = dbot.db.quoteArrs,
    this.addStack = [],
    this.rmAllowed = true,
    this.rmCache = dbot.sessionData.rmCache,
    this.rmTimer;

    this.internalAPI = {
        // Retrieve a random quote from a given category, interpolating any quote
        // references (~~QUOTE CATEGORY~~) within it
        'interpolatedQuote': function(server, channel, user, key, quoteTree) {
            if(!_.isUndefined(quoteTree) && quoteTree.indexOf(key) != -1) { 
                return ''; 
            } else if(_.isUndefined(quoteTree)) { 
                quoteTree = [];
            }

            var index = _.random(0, this.quotes[key].length - 1);
            var quoteString = this.quotes[key][index];

            // Parse quote interpolations
            var quoteRefs = quoteString.match(/~~([\d\w\s-]*)~~/g);
            var thisRef;

            while(quoteRefs && (thisRef = quoteRefs.shift()) !== undefined) {
                var cleanRef = dbot.cleanNick(thisRef.replace(/^~~/,'').replace(/~~$/,'').trim());
                if(cleanRef === '-nicks-') {
                    var randomNick = dbot.api.users.getRandomChannelUser(server, channel);
                    quoteString = quoteString.replace("~~" + cleanRef + "~~", randomNick);
                    quoteTree.pop();
                } else if(cleanRef === '-user-') {
                    quoteString = quoteString.replace("~~" + cleanRef + "~~", user);
                    quoteTree.pop();
                } else if(_.has(this.quotes, cleanRef)) {
                    quoteTree.push(key);
                    quoteString = quoteString.replace("~~" + cleanRef + "~~", 
                            this.internalAPI.interpolatedQuote(server, channel, user, cleanRef, quoteTree.slice()));
                    quoteTree.pop();
                }
            }

            return quoteString;
        }.bind(this),

        'resetRemoveTimer': function(event, key, quote) {
            this.rmAllowed = false;
            setTimeout(function() {
                this.rmAllowed = true;
            }.bind(this), 5000);

            this.rmCache.push({
                'key': key, 
                'quote': quote
            });

            clearTimeout(this.rmTimer);
            if(this.rmCache.length < dbot.config.quotes.rmLimit) {
                this.rmTimer = setTimeout(function() {
                    this.rmCache.length = 0; // lol what
                }.bind(this), 600000);
            } else {
                _.each(dbot.config.admins, function(admin) {
                    dbot.say(event.server, admin, dbot.t('rm_cache_limit'));
                });
            }
        }.bind(this)
    };

    this.api = {
        'getQuote': function(event, category) {
            var key = category.trim().toLowerCase();
            var altKey;
            if(key.split(' ').length > 0) {
                altKey = key.replace(/ /g, '_');
            }

            if(key.charAt(0) !== '_') { // lol
                if(_.has(this.quotes, key)) {
                    return this.internalAPI.interpolatedQuote(event.server, event.channel.name, event.user, key);
                } else if(_.has(this.quotes, altKey)) {
                    return this.internalAPI.interpolatedQuote(event.server, event.channel.name, event.user, altKey);
                } else {
                    return false;
                }
            } 
        },

        'getQuoteCategory': function(name) {
            console.log(name);
            var key = name.trim().toLowerCase();
            if(_.has(this.quotes, key)) {
                return this.quotes[key];
            } else {
                return false;
            }
        }
    };

    this.api['getQuoteCategory'].external = true;
    this.api['getQuoteCategory'].extMap = [ 'name' ];
   
    this.listener = function(event) {
        if(event.action == 'PRIVMSG') {
            if(event.user == 'reality') {
                var once = event.message.valMatch(/^I ([\d\w\s,'-]* once)/, 2);
            } else {
                var once = event.message.valMatch(/^reality ([\d\w\s,'-]* once)/, 2);
            }

            if(once) {
                event.message = '~qadd realityonce=reality ' + once[1];
                event.action = 'PRIVMSG';
                event.params = event.message.split(' ');
                dbot.instance.emit(event);
            }
        } else if(event.action == 'JOIN') {
            if(this.config.quotesOnJoin == true) {
                var userQuote = this.api.getQuote(event, event.user)
                if(userQuote) {
                    event.reply(event.user + ': ' + this.api.getQuote(event, event.user));
                }
            }
        }
    }.bind(this);
    this.on = ['PRIVMSG', 'JOIN'];
};

exports.fetch = function(dbot) {
    return new quotes(dbot);
};
