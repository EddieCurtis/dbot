var _ = require('underscore')._,
    async = require('async');

var pages = function(dbot) {
    var pages = {
        '/notify': function(req, res) {
            res.render('servers', {  
                'servers': _.keys(dbot.config.servers)
            });
        },

        '/notify/:server': function(req, res) {
            var server = req.params.server,
                userCount = {},
                users = [];

            this.db.scan('notifies', function(notify) {
                if(!_.has(userCount, notify.user)) {
                    userCount[notify.user] = 1;
                } else {
                    userCount[notify.user]++;
                }
            }, function() {
                userCount = _.map(userCount, function(value, key) { 
                    return {
                        'id': key, 
                        'count': value 
                    } 
                });

                async.eachSeries(userCount, function(userCount, next) {
                    dbot.api.users.getUser(userCount.id, function(user) {
                        if(user) {
                            userCount['name'] = user.primaryNick;
                            users.push(userCount);
                        }
                        next();
                    });
                }, function() {
                    res.render('channels', {
                        'server': server,
                        'users': users,
                        'channels': _.keys(dbot.instance.connections[server].channels)
                    });
                });
            });
        },

        '/notify/:server/missing': function(req, res) {
            var server = req.params.server,
                user = req.user,
                notifies = this.pending[user.id];

            res.render('missing_notifies', {
                'user': user.primaryNick,
                'notifies': _.sortBy(notifies, 'time')
            });

            if(_.has(dbot.modules, 'log')) {
                dbot.api.log.log(server, user.primaryNick, 
                    'Checked their missing notifications.');
            }
        },

        '/notify/:server/:item': function(req, res) {
            var server = req.params.server,
                notifies = [];

            if(req.params.item.charAt(0) == '#') {
                var channel = req.params.item;

                this.db.search('notifies', {
                    'server': server,
                    'channel': channel
                }, function(notify) {
                    notifies.push(notify);
                }, function(err) {
                    var pNickCache = {};
                    async.eachSeries(notifies, function(notify, next) {
                        if(!_.has(pNickCache, notify.user)) {
                            dbot.api.users.getUser(notify.user, function(user) {
                                pNickCache[notify.user] = user.primaryNick;
                                notify.user = user.primaryNick; 
                                next();
                            });
                        } else {
                            notify.user = pNickCache[notify.user];
                            next();
                        }
                    }, function() {
                        res.render('notifies', {
                            'server': server,
                            'notifies': _.sortBy(notifies, 'time')
                        });
                    });
                });
            } else {
                var username = req.params.item;

                dbot.api.users.resolveUser(server, username, function(user) {
                    this.db.search('notifies', {
                        'user': user.id
                    }, function(notify) {
                        notify.user = user.primaryNick;
                        notifies.push(notify);
                    }, function() {
                        res.render('notifies', {
                            'server': server,
                            'notifies': _.sortBy(notifies, 'time')
                        });
                    });
                }.bind(this));
            }
        }
    };

    return pages;
};

exports.fetch = function(dbot) {
    return pages(dbot);
};
