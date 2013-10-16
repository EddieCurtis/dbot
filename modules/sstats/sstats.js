/**
 * Module Name: sstats
 * Description: Simple Stats, in the absence of good ones.
 */
var _ = require('underscore')._;

var sstats = function(dbot) {
    this.listener = function(event) {
        event.cStats.lines++;
        event.uStats.lines++;
        if(!_.has(event.uStats.channels, event.rChannel.id)) {
            event.uStats.channels[event.rChannel.id] = { 
                'lines': 1
            };
        } else {
            event.uStats.channels[event.rChannel.id].lines++;
        }
        this.db.save('channel_stats', event.cStats.id, event.cStats, function() {});
        this.db.save('user_stats', event.uStats.id, event.uStats, function() {});
    }.bind(this);
    this.on = 'PRIVMSG';

    this.onLoad = function() {
        // Preload user stats
        dbot.instance.addPreEmitHook(function(event, callback) {
            if(!event.rUser) return callback();
            this.api.getUserStats(event.rUser.id, function(uStats) {
                if(uStats) {
                    event.uStats = uStats;
                    callback();
                } else {
                    this.api.createUserStats(event.rUser.id, function(uStats) {
                        event.uStats = uStats;
                        callback();
                    });
                }
            }.bind(this));
        }.bind(this));

        // Preload channel stats
        dbot.instance.addPreEmitHook(function(event, callback) {
            if(!event.rChannel) return callback();
            this.api.getChannelStats(event.rChannel.id, function(cStats) {
                if(cStats) {
                    event.cStats = cStats;
                    callback();
                } else {
                    this.api.createChannelStats(event.rChannel.id, function(cStats) {
                        event.cStats = cStats;
                        callback();
                    });
                }
            }.bind(this));
        }.bind(this));
    }.bind(this);
};

exports.fetch = function(dbot) {
    return new sstats(dbot);
};
