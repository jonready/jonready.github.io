const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://jonready.com';
const BLOG_URL = `${SITE_URL}/blog/`;
const FEED_PATH = path.join(__dirname, '..', 'blog', 'feed.xml');
const POSTS_PATH = path.join(__dirname, '..', 'blog', 'posts.json');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRssDate(date) {
  const parsed = new Date(`${date} 00:00:00 GMT`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unable to parse post date: ${date}`);
  }

  return parsed.toUTCString();
}

function buildFeed(posts) {
  const latestPostDate = posts.length > 0 ? formatRssDate(posts[0].date) : new Date().toUTCString();
  const items = posts.map((post) => {
    const postUrl = new URL(post.url, BLOG_URL).href;

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${formatRssDate(post.date)}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
  }).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Jonathon Ready Blog</title>
    <link>${BLOG_URL}</link>
    <description>Thoughts on building, exploring, and technology.</description>
    <language>en-us</language>
    <lastBuildDate>${latestPostDate}</lastBuildDate>

${items}
  </channel>
</rss>
`;
}

function main() {
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
  const feed = buildFeed(posts);

  fs.writeFileSync(FEED_PATH, feed);
  console.log(`Generated ${path.relative(process.cwd(), FEED_PATH)} from ${posts.length} posts.`);
}

main();
