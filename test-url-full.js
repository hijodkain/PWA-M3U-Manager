const fetchUrl = "https://raw.githubusercontent.com/shareext-reborn/Shareext-UpdateFilesSports.m3u/refs/heads/main/Shareext%40playlist";
const u = new URL(fetchUrl);
let suggestedName = "test";
const user = u.searchParams.get('username') || u.searchParams.get('user');
if (user) {
    suggestedName = `Lista-${user}`;
} else {
    const pathParts = u.pathname.split('/');
    const last = pathParts[pathParts.length - 1];
    console.log("last:", last);
    if (last && last !== 'get.php') {
        suggestedName = decodeURIComponent(last).replace(/\.(m3u8?|txt)$/i, '') || u.hostname;
    } else {
        suggestedName = u.hostname;
    }
}
console.log("suggestedName:", suggestedName);
