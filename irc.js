var Irc = require('irc');
var tg = require('./tg');

var lookupChannel = function(chanName, channels) {
    return channels.filter(function(channel) {
        return channel['ircChan'] === chanName;
    })[0];
};

// generates channel list for ircOptions
var getChannels = function(arr) {
    var result = [];

    for (var i = 0; i < arr.length; i++) {
        var chanName = arr[i].chanPwd ?
                       arr[i].ircChan + ' ' + arr[i].chanPwd :
                       arr[i].ircChan;
        result.push(chanName);
    }

    return result;
};

module.exports = function(config, sendTo) {
    config.ircOptions.channels = getChannels(config.channels);

    var irc = new Irc.Client(config.ircServer, config.ircNick, config.ircOptions);

    irc.on('error', function(error) {
        console.error('IRC ERROR: ' + error);
    });

    irc.on('message', function(user, chanName, message) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }

        var match = config.hlRegexp.exec(message);
        if (match || config.ircRelayAll) {
            if (match) {
                message = match[1].trim();
            }
            var text = '<' + user + '>: ' + message;
            sendTo.tg(channel, text);
        }
    });

    irc.on('action', function(user, chanName, message) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }

        var match = config.hlRegexp.exec(message);
        if (match || config.ircRelayAll) {
            if (match) {
                message = match[1].trim();
            }
            var text = '*' + user + ': ' + message + '*';
            sendTo.tg(channel, text);
        }
    });

    irc.on('topic', function(chanName, topic, nick) {
        var channel = lookupChannel(chanName, config.channels);
        if (!channel) {
            return;
        }

        // ignore first topic event when joining channel
        // (doesn't handle rejoins yet)
        if (!config.sendTopic || !channel.firstTopicRcvd) {
            channel.firstTopicRcvd = true;
            return;
        }

        var text = '* Topic for channel ' + channel.chanAlias || channel.ircChan +
                   ':\n' + topic.split(' | ').join('\n') +
                   '\n* set by ' + nick.split('!')[0];
        sendTo.tg(channel, text);
    });

    sendTo.irc = function(chanName, msg) {
        console.log('  >> relaying to IRC: ' + msg);
        irc.say(chanName, msg);
    };
};
