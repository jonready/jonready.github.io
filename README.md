# jonready.com

Static personal site hosted with GitHub Pages.

## Blog RSS Feed

The blog RSS feed is generated from `blog/posts.json`.

After adding or editing a blog post, update `blog/posts.json`, then run:

```sh
node scripts/generate-rss.js
```

This writes `blog/feed.xml`, which is published at:

```text
https://jonready.com/blog/feed.xml
```

The homepage and blog index include RSS discovery metadata so feed readers can find it automatically.
