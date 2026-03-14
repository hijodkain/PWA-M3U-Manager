const fetchUrl = "https://raw.githubusercontent.com/shareext-reborn/Shareext-UpdateFilesSports.m3u/refs/heads/main/Shareext%40playlist";
const u = new URL(fetchUrl);
const parts = u.pathname.split('/').filter(Boolean);
const isXtreamV2 =
    (parts.length === 2 || parts.length === 3) &&
    !fetchUrl.includes('get.php') &&
    !fetchUrl.endsWith('.m3u') &&
    !fetchUrl.endsWith('.m3u8') &&
    !fetchUrl.endsWith('.txt') &&
    !u.hostname.includes('github') &&
    !u.hostname.includes('pastebin') &&
    (u.searchParams.size === 0 || (u.searchParams.has('username') && u.searchParams.has('password')));

console.log("isXtreamV2:", isXtreamV2);
console.log("parts:", parts.length);
