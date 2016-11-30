
var moment = require('moment');

module.exports = YoutubeVideo = function(url, info) {
    this.url = url;
    this.info = info;
};

YoutubeVideo.prototype.title = function () {
    return this.info.title;
};

YoutubeVideo.prototype.author = function () {
    return this.info.author;
};

YoutubeVideo.prototype.length = function () {
    var secs = this.info.lengthSeconds || this.info.length_seconds;
    console.log(`length(): secs = ${secs}`);
    return moment().seconds(secs).format('mm:ss');
};

YoutubeVideo.prototype.link = function () {
    return this.url;
};

YoutubeVideo.prototype.logString = function () {
    return `URL=${this.url}\nTitle=${this.title()}\nLength=${this.length()}`;
};
