const ver = 0.01;

function log(msg) {
    console.log(msg);
}

log("JeffyBot ver " + ver);

const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const BOT_TOKEN = process.env.JEFFYPOO_BOT_TOKEN;
const Discord = require("discord.js");
const client = new Discord.Client();
const fs = require('fs');
const ytdl = require('ytdl-core');
const request = require('superagent');
const url = require('url');

let boundTextChannel;
let boundVoiceChannel;
let voiceStreamDispatcher;

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
            if (boundVoiceChannel && msg.member.voiceChannel != boundVoiceChannel) {
                msg.reply(`I'm already playing music in '${boundVoiceChannel.name}'`);
                return;
            }
            const channel = msg.member.voiceChannel;
            if (channel && channel.joinable) {
                log(`Joining voice channel '${channel.name}'...`);
                channel.join()
                    .then(conn => {
                        boundVoiceChannel = channel;
                        log(`Joined '${boundVoiceChannel.name}'.`);
                        searchAndPlay(bot, msg, args, conn);
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

function searchAndPlay(bot, msg, args, conn) {
    const searchURL = getYoutubeSearchURL(args);
    request(searchURL, (err, resp) => {
        if (!err && resp.statusCode == 200) {
            if (resp.body.items.length == 0) {
                msg.reply(`No videos matching '${args.trim()}'`);
                leaveVoiceChannel();
                return;
            }
            for (let item of resp.body.items) {
                if (item.id.kind === 'youtube#video') {
                    const vidUrl = 'http://www.youtube.com/watch?v=' + item.id.videoId;
                    log(`video URL = ${vidUrl}`);
                    msg.reply("Now Playing: " + vidUrl);
                    const stream = ytdl(vidUrl, {audioonly: true});
                    voiceStreamDispatcher = conn.playStream(stream);
                    return;
                }
            }
        }
    })
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
            log('stopping voice stream')
            voiceStreamDispatcher.end();
            voiceStreamDispatcher = false;
        }
        log(`leaving voice channel '${boundVoiceChannel.name}'`);
        boundVoiceChannel.leave();
        boundVoiceChannel = false;
    }
}

client.on('ready', () => {
    log(`Logged in as ${client.user.username}#${client.user.discriminator} (${client.readyAt})`);
    client.syncGuilds();
});

client.on('message', msg => {
    if (msg.author.bot) return;
    checkCmd(msg);
});

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

client.on('disconnected', () => {
    log("Client disconnected!");
    process.exit(-1);
});

client.login(BOT_TOKEN);

