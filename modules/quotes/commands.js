var _ = require('underscore')._,
    databank = require('databank'),
    uuid = require('node-uuid');

var commands = function(dbot) {
    var quotes = dbot.db.quoteArrs;
    var commands = {
        /*** Quote Addition ***/

        // Add a quote to a category
        '~qadd': function(event) {
            var key = event.input[1].toLowerCase().trim(),
                quote = event.input[2],
                newCount,
                category = false;

            this.db.search('quote_category', { 'name': key }, function(result) {
                category = result;
            }, function(err) {
                if(!category) {
                    var id = uuid.v4();
                    category = {
                        'id': id,
                        'name': key,
                        'quotes': [], 
                        'creator': event.user
                    };
                } 

                newCount = category.quotes.push(quote);
                this.db.save('quote_category', category.id, category, function(err) {
                    this.rmAllowed = true;
                    dbot.api.event.emit('~qadd', {
                        'key': key,
                        'text': quote
                    });
                    event.reply(dbot.t('quote_saved', {
                        'category': key, 
                        'count': newCount
                    }));
                });
            }.bind(this));
        },

        /*** Quote Retrieval ***/

        // Alternative ~q syntax
        '~': function(event) {
            commands['~q'].bind(this)(event);
        },

        // Retrieve quote from a category in the database.
        '~q': function(event) {
            var name = event.input[1].trim().toLowerCase(),
                category = false;

            this.db.search('quote_category', { 'name': name }, function(result) {
                category = result;
            }, function(err) {
                if(category) {
                    var quotes = category.quotes;
                    var index = _.random(0, quotes.length - 1); 
                    event.reply(name + ': ' + quotes[index]);
                } else {
                    event.reply(dbot.t('category_not_found', { 'category': name }));
                }
            });
        },

        // Choose a random quote category and a random quote from that
        // TODO: This is quite inefficient, but databank must evolve to do otherwise.
        '~rq': function(event) {
            var categories = []; 
            this.db.scan('quote_category', function(result) {
                categories.push(result);
            }, function(err) {
                var cIndex = _.random(0, _.size(categories) -1); 
                var qIndex = _.random(0, categories[cIndex].quotes.length - 1); 
                event.reply(categories[cIndex].name + ': ' + categories[cIndex].quotes[qIndex]);
            });
        },

        /*** Quote Removal
                TODO: Remove empty quote categories
        ***/

        // Show number of quotes in removal cache
        '~rmstatus': function(event) {
            var rmCacheCount = this.rmCache.length;
            if(rmCacheCount < dbot.config.quotes.rmLimit) {
                event.reply(dbot.t('quote_cache_auto_remove', 
                    { 'count': rmCacheCount }));
            } else {
                event.reply(dbot.t('quote_cache_manual_remove', 
                    { 'count': rmCacheCount }));
            }
        },

        // Confirm removal of quote cache
        '~rmconfirm': function(event) {
            var rmCacheCount = this.rmCache.length;
            this.rmCache.length = 0;
            event.reply(dbot.t('quote_cache_cleared', 
                { 'count': rmCacheCount }));
        },

        // Reinstate all quotes in removal cache
        '~rmdeny': function(event) {
            var rmCache = this.rmCache;
            var rmCacheCount = rmCache.length;
            
            _.each(rmCache, function(quote, index) {
                //TODO: Add quote add API func
                var qadd = _.clone(event);
                qadd.message = '~qadd ' + quote.key + '=' + quote.quote;
                dbot.instance.emit(qadd);
            });

            rmCache.length = 0;
            event.reply(dbot.t('quote_cache_reinstated', 
                { 'count': rmCacheCount }));
        },

        // Remove last quote from category
        '~rmlast': function(event) {
            if(this.rmAllowed === true || _.include(dbot.config.admins, event.user)) {
                var key = event.input[1].trim().toLowerCase(),
                    category = false;

                this.db.search('quote_category', { 'name': key }, function(result) {
                    category = result;    
                }, function(err) {
                    if(category) {
                        var removedQuote = category.quotes.pop();
                        this.db.save('quote_category', category.id, category, function(err) {
                            this.internalAPI.resetRemoveTimer(event, key, removedQuote);
                            event.reply(dbot.t('removed_from', {
                                'quote': removedQuote, 
                                'category': key
                            }));
                        }.bind(this));
                    } else {
                        event.reply(dbot.t('category_not_found', { 'category': key }));
                    }
                }.bind(this));
            } else {
                event.reply(dbot.t('rmlast_spam'));
            }
        },

        // Remove specific quote from category
        '~rm': function(event) {
            if(this.rmAllowed == true || _.include(dbot.config.admins, event.user)) {
                var key = event.input[1].trim().toLowerCase();
                    quote = event.input[2],
                    category = false;

                this.db.search('quote_category', { 'name': key }, function(result) {
                    category = result;
                }, function(err) {
                    if(category) {
                        if(category.quotes.indexOf(quote) != -1) {
                            category.quotes = _.without(category.quotes, quote);
                            this.db.save('quote_category', category.id, category, function(err) {
                                this.internalAPI.resetRemoveTimer(event, key, quote);
                                event.reply(dbot.t('removed_from', {
                                    'category': key, 
                                    'quote': quote
                                }));
                            }.bind(this));
                        } else {
                            event.reply(dbot.t('q_not_exist_under', {
                                'category': key, 
                                'quote': quote
                            }));
                        }
                    } else {
                        event.reply(dbot.t('category_not_found', { 'category': key }));
                    }
                }.bind(this));
            } else {
                event.reply(dbot.t('rmlast_spam'));
            }
        },

        /*** Quote Statistics and Searching ***/

        // Shows a list of the biggest categories
        '~qstats': function(event) {
            var quoteSizes = {};
            this.db.scan('quote_category', function(category) {
                if(category) {
                    quoteSizes[category.name] = category.quotes.length; 
                }
            }.bind(this), function(err) {
                var qSizes = _.chain(quoteSizes)
                    .pairs()
                    .sortBy(function(category) { return category[1] })
                    .reverse()
                    .first(10)
                    .value();

                var qString = dbot.t('large_categories');
                for(var i=0;i<qSizes.length;i++) {
                    qString += qSizes[i][0] + " (" + qSizes[i][1] + "), ";
                }

                event.reply(qString.slice(0, -2));
            });
        },
        
        // Search a given category for some text.
        '~qsearch': function(event) {
            var haystack = event.input[1].trim().toLowerCase(),
                needle = event.input[2],
                category = false;

            this.db.search('quote_category', { 'name': haystack }, function(result) {
                category = result;
            }, function(err) {
                if(category) {
                    var matches = _.filter(category.quotes, function(quote) {
                        return quote.indexOf(needle) != -1;
                    });

                    if(matches.length == 0) {
                        event.reply(dbot.t('no_results'));
                    } else {
                        event.reply(dbot.t('search_results', {
                            'category': haystack, 
                            'needle': needle,
                            'quote': matches[0],
                            'matches': matches.length
                        }));
                    }
                } else {
                    event.reply(dbot.t('empty_category'));
                }
            });
        },
       
        // Count quotes in a given category or total quotes overall
        '~qcount': function(event) {
            var input = event.message.valMatch(/^~qcount ([\d\w\s-]*)/, 2);
            if(input) { // Give quote count for named category
                var key = input[1].trim().toLowerCase(),
                    category = false;

                this.db.search('quote_category', { 'name': key }, function(result) {
                    category = result;
                }, function(err) {
                    if(category) {
                        event.reply(dbot.t('quote_count', {
                            'category': key, 
                            'count': category.quotes.length
                        }));
                    } else {
                        event.reply(dbot.t('category_not_found', { 'category': name }));
                    }
                });
            } else {
                var quoteCount = 0;
                this.db.scan('quote_category', function(category) {
                    if(category) {
                        quoteCount += category.quotes.length; 
                    }
                }, function(err) {
                    event.reply(dbot.t('total_quotes', { 'count': quoteCount }));
                });
            }
        },

        // Link to quote web page
        '~link': function(event) {
            var key = event.input[1].toLowerCase(),
                category = false;

            this.db.search('quote_category', { 'name': key }, function(result) {
                category = result;
            }, function(err) {
                if(category) {
                    if(_.has(dbot.config, 'web') && _.has(dbot.config.web, 'webHost')) {
                        event.reply(dbot.t('quote_link', {
                            'category': key, 
                            'url': dbot.t('url', {
                                'host': dbot.config.web.webHost, 
                                'port': dbot.config.web.webPort, 
                                'path': 'quotes/' + encodeURIComponent(key)
                            })
                        }));
                    } else {
                        event.reply(dbot.t('web_not_configured'));
                    }
                } else {
                    event.reply(dbot.t('category_not_found', { 'category': key }));
                }
            });
        }
    };

    commands['~'].regex = [/^~([\d\w\s-]*)/, 2];
    commands['~q'].regex = [/^~q ([\d\w\s-]*)/, 2];
    commands['~qsearch'].regex = [/^~qsearch ([\d\w\s-]+?)[ ]?=[ ]?(.+)$/, 3];
    commands['~rm'].regex = [/^~rm ([\d\w\s-]+?)[ ]?=[ ]?(.+)$/, 3];
    commands['~rmlast'].regex = [/^~rmlast ([\d\w\s-]*)/, 2];
    commands['~qadd'].regex = [/^~qadd ([\d\w-]+[\d\w\s-]*)[ ]?=[ ]?(.+)$/, 3];
    commands['~link'].regex = [/^~link ([\d\w\s-]*)/, 2];

    commands['~rmconfirm'].access = 'moderator';
    commands['~rmdeny'].access = 'moderator';

    return commands;
};

exports.fetch = function(dbot) {
    return commands(dbot);
};
