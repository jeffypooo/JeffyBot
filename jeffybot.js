const ver = 0.01;

function log(msg) {
    console.log(msg);
}

function logErr(msg, err = false) {
    console.error(`${msg} ${err || ''}`);
}

log("JeffyBot ver " + ver);
checkEnv();

const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const BOT_TOKEN = process.env.JEFFYPOO_BOT_TOKEN;
const Discord = require("discord.js");
const client = new Discord.Client();
const fs = require('fs');
const ytdl = require('ytdl-core');
const request = require('superagent');
const url = require('url');

let YoutubeVideo = require('./model/YoutubeVideo.js');

let boundTextChannel;
let boundVoiceChannel;
let voiceStreamDispatcher;
let playQueue = [];

client.on('ready', () => {
    log(`Logged in as ${client.user.username}#${client.user.discriminator} (${client.readyAt})`);
    client.syncGuilds();
});

client.on('message', msg => {
    if (msg.author.bot) return;
    checkCmd(msg);
});

client.on('disconnected', () => {
    log("Client disconnected!");
    process.exit(-1);
});

client.login(BOT_TOKEN);


const commands = {
    "say": {
        argsDesc: "[message]",
        desc: "Speak as JeffyBot himself.",
        process: function (bot, msg, args) {
            log(`say: '${args}'`);
            if (msg.deletable) {
                msg.delete().then(function (deleted) {
                    log(`Deleted orig msg: '${deleted.content}'`);
                }).catch(console.error)
            }
            msg.channel.sendMessage(args);
        }
    },
    "play": {
        argsDesc: "[artist and/or song name]",
        desc: "Searches youtube for a song and plays it.",
        process: function (bot, msg, args) {
            log(`play: '${args.trim()}'`);
            if (boundTextChannel != msg.channel) {
                log(`Binding text channel to '${msg.channel.name}'`);
                boundTextChannel = msg.channel;
            }
            if (boundVoiceChannel && msg.member.voiceChannel != boundVoiceChannel) {
                msg.reply(`I'm already playing music in '${boundVoiceChannel.name}'`);
                return;
            } else if (boundVoiceChannel) {
                searchAndQueue(bot, msg, args, boundVoiceChannel.connection);
                return;
            }
            const channel = msg.member.voiceChannel;
            if (channel && channel.joinable) {
                log(`Joining voice channel '${channel.name}'...`);
                channel.join()
                    .then(conn => {
                        boundVoiceChannel = channel;
                        log(`Joined '${boundVoiceChannel.name}'.`);
                        searchAndQueue(bot, msg, args, conn);
                    })
                    .catch(console.error);
            }

        }
    },
    "stop": {
        argsDesc: false,
        desc: "Stops any playing music.",
        process: function (bot, msg, args) {
            log('stop');
            if (voiceStreamDispatcher) {
                msg.reply('Stopping...');
            }
            playQueue = [];
            leaveVoiceChannel();
        }
    },
    "pause": {
        argsDesc: false,
        desc: "Pauses any playing music (resume by calling !resume)",
        process: function (bot, msg, args) {
            log('pause');
            pausePlayback(msg);
        }
    },
    "resume": {
        argsDesc: false,
        desc: "Resumes paused music.",
        process: function (bot, msg, args) {
            log('resume');
            resumePlayback(msg);
        }
    }
};

function searchAndQueue(bot, msg, args, conn) {
    const searchURL = getYoutubeSearchURL(args);
    msg.reply('Searching...');
    request(searchURL, (err, resp) => {
        if (!err && resp.statusCode == 200) {
            if (resp.body.items.length == 0) {
                msg.reply(`No videos matching '${args.trim()}'`);
                return;
            }
            for (let item of resp.body.items) {
                if (item.id.kind === 'youtube#video') {
                    const vidUrl = 'http://www.youtube.com/watch?v=' + item.id.videoId;
                    log(`video URL = ${vidUrl}`);
                    getVideoInfo(vidUrl, (err, info) => {
                        if (err) {
                            logErr("error getting video metadata", err);
                            return;
                        }
                        playQueue.push(new YoutubeVideo(vidUrl, info));
                        msg.reply('Queued.');
                        log(`queued video (${playQueue.length} songs in queue)`);
                        if (!voiceStreamDispatcher) {
                            playNext();
                        }
                    });
                    return;
                }
            }
        }
    })
}

function getVideoInfo(url, cb) {
    ytdl.getInfo(url, (err, info) => {
        if (err) cb(err, undefined);
        else {
            cb(undefined, info);
        }
    })
}

function playNext() {
    let next = playQueue.shift();
    if (next) {
        log(`playNext(): preparing track:\n${next.logString()}`);
        const title = next.title();
        const author = next.author();
        const length = next.length();
        const link = next.link();
        const stream = ytdl.downloadFromInfo(next.info, {audioonly: true});
        voiceStreamDispatcher = boundVoiceChannel.connection.playStream(stream);
        voiceStreamDispatcher.once('end', () => {
            log(`track '${title}' ended`);
            voiceStreamDispatcher = false;
            playNext();
        });
        boundTextChannel.sendMessage(`\n**Now Playing** : ${title}\n**Length** : ${length}\n**Uploader** : ${author}\n**Link** : ${link}`);
    }
}

function pausePlayback(msg) {
    if (voiceStreamDispatcher) {
        if (voiceStreamDispatcher.paused) {
            msg.reply("I'm already paused.");
        } else {
            msg.reply("Pausing...");
            voiceStreamDispatcher.pause();
        }
    }
}

function resumePlayback(msg) {
    if (voiceStreamDispatcher) {
        if (!voiceStreamDispatcher.paused) {
            msg.reply("I'm not paused.");
        } else {
            msg.reply("Resuming...");
            voiceStreamDispatcher.resume();

        }
    }
}

function getYoutubeSearchURL(query) {
    return `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${escape(query.trim())}&key=${YT_API_KEY}`;
}


function leaveVoiceChannel() {
    if (boundVoiceChannel) {
        if (voiceStreamDispatcher) {
            log('stopping voice stream');
            voiceStreamDispatcher.end();
            voiceStreamDispatcher = false;
        }
        log(`leaving voice channel '${boundVoiceChannel.name}'`);
        boundVoiceChannel.leave();
        boundVoiceChannel = false;
    }
}

function checkCmd(msg) {
    if (msg.content === '!help') {
        printCommands(msg);
        return;
    }
    const words = msg.content.split(" ");
    if (words[0].charAt(0) != '!') {
        log("ignored");
        return;
    }
    const cmd = commands[words[0].substring(1)];
    if (cmd) {
        var args = msg.content.substring(words[0].length);
        cmd.process(client, msg, args);
    }
}

function printCommands(msg) {
    let cmdsString = "\nCommands:\n";
    for (let cmd in commands) {
        if (!commands[cmd]) continue;
        const cmdBody = commands[cmd];
        var argsDesc = cmdBody.argsDesc || '';
        cmdsString += `\n**!${cmd} ${argsDesc}** : ${cmdBody.desc}\n`;
    }
    msg.reply(cmdsString);
}

function checkEnv() {
    if (!process.env.JEFFYPOO_BOT_TOKEN) {
        logErr('ENV var JEFFYPOO_BOT_TOKEN not defined.');
        process.exit(-2);
    }
    if (!process.env.YOUTUBE_API_KEY) {
        logErr('ENV var YOUTUBE_API_KEY not defined.');
        process.exit(-2);
    }
}



