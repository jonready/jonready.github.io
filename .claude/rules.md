# Project Rules

## Blog Posts

When creating a new blog post:
1. Create the HTML file in `blog/posts/`
2. **Always update `blog/posts.json`** with the new post metadata (title, date, url, excerpt)
3. Ensure the post follows the template structure in `blog/posts/example-post.html`

The blog index page dynamically loads posts from `posts.json`, so forgetting to update it will cause the new post to not appear on the blog listing.
