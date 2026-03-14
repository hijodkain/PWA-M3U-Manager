const fetchUrl = "https://raw.githubusercontent.com/shareext-reborn/Shareext-UpdateFilesSports.m3u/refs/heads/main/Shareext%40playlist";
const u = new URL(fetchUrl);
let suggestedName = "test";
const pathParts = u.pathname.split('/');
const last = pathParts[pathParts.length - 1];
suggestedName = last.replace(/\.(m3u8?|txt)$/i, '') || u.hostname;
console.log(suggestedName);
