# Gloria & Carl Wedding Live Album

Wedding date: 2026-11-22
Capacity target: 100 concurrent guests

## Product rules
- Guest QR entry, no account required.
- Upload photos and videos, including multi-select.
- Originals are archived to Google Drive.
- Live Album shows optimized previews/thumbnails and updates in realtime.
- Gallery supports fullscreen media, video playback, likes and slideshow mode.
- Optional guest/uploader display name.
- Admin can hide/unhide/remove media from the Live Album.
- Hiding or deleting from the Live Album MUST NOT delete the Google Drive original.
- Deleting the Google Drive original is a separate admin-only destructive action with explicit confirmation.
- Upload UI has per-file progress, retry, failed-file recovery and keeps completed files completed.
- Design for 100 guests uploading in a burst; do not proxy large video bodies through Vercel serverless functions.

## Storage architecture
1. Browser requests a short-lived upload session from a trusted backend.
2. Photo/video original uploads using Google Drive resumable upload.
3. Backend records media metadata in Supabase.
4. Live Gallery uses lightweight preview/thumbnail assets rather than loading Drive originals in the grid.
5. Supabase Realtime broadcasts published media / hide / like changes.

## Google Drive folders
- Gloria & Carl Wedding 2026/
  - Guest Photos/
  - Guest Videos/

## Suggested media table
- id uuid primary key
- type photo|video
- original_name text
- mime_type text
- byte_size bigint
- drive_file_id text (never expose write credentials)
- preview_url text
- thumbnail_url text
- uploader_name text nullable
- status uploading|processing|published|failed|hidden
- like_count integer default 0
- created_at timestamptz
- hidden_at timestamptz nullable

## Security
- Never expose Google OAuth refresh tokens, Drive credentials, Supabase secret/service-role keys in the browser.
- Public guest access is limited to the minimum upload/gallery actions.
- Admin actions require authenticated authorization.
- Rate-limit session creation and metadata writes.
- Validate MIME type, file size and filename server-side.
- RLS on every exposed Supabase table.

## 100-guest reliability requirements
- Google Drive resumable uploads for videos/large media.
- Retry individual files rather than entire batches.
- Client concurrency cap to avoid one phone saturating the venue network.
- Lazy-load gallery media.
- Generate small previews/thumbnails.
- Do not autoplay gallery videos with sound.
- Graceful network interruption states.

## Pages
- `/` — wedding landing page; Upload + Live Album
- `/upload` — picker, queue, progress, retry
- `/album` — realtime masonry gallery
- `/slideshow` — venue display mode
- `/admin` — moderation/settings

## Pending one-time setup
- Enable Google Drive API in the owner's Google Cloud project.
- Complete owner OAuth consent once and securely store server-side credentials/tokens.
- Configure Drive Photos/Videos folder IDs.
- Configure Supabase project and RLS/migrations.
- Configure Vercel environment variables and deployment.

## Deployment note
Keep this app independent from Project Finance business data. Do not reset, duplicate, or modify existing finance data.
