
// var moment = require('moment');

// module.exports = YoutubeVideo = function(url, info) {
//     this.url = url;
//     this.info = info;
// };
//
// YoutubeVideo.prototype.title = function () {
//     return this.info.title;
// };
//
// YoutubeVideo.prototype.author = function () {
//     return this.info.author;
// };
//
// YoutubeVideo.prototype.length = function () {
//     var secs = this.info.lengthSeconds || this.info.length_seconds;
//     console.log(`length(): secs = ${secs}`);
//     return ;
// };
//
// YoutubeVideo.prototype.link = function () {
//     return this.url;
// };
//
// YoutubeVideo.prototype.logString = function () {
//     return `URL=${this.url}\nTitle=${this.title()}\nLength=${this.length()}`;
// };

module.exports = class YoutubeVideo {

    constructor(url, info) {
        this.url = url;
        this.info = info;
    }

    get title() {
        return this.info.title;
    }

    get author() {
        return this.info.author
    }

    get length() {
        return this.info.lengthSeconds || this.info.length_seconds;
    }

    get link() {
        return this.url
    }

    get debugDescription() {
        return `URL=${this.url}\nTitle=${this.title}\nLength=${this.length}`;
    }

};