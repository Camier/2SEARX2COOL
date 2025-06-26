# Working Music Engines in SearXNG

## ✅ Currently Working (11 engines)

### API-Based Engines
1. **Last.fm** - 30 results ✅
   - Music discovery, artist info, tags
   - Using API key provided
   
2. **Deezer** - 25 results ✅
   - Streaming service search
   - 30-second previews
   
3. **MusicBrainz** - 20 results ✅
   - Open music encyclopedia
   - Detailed metadata

### Web Scraping Engines
4. **Free Music Archive** - 20 results ✅
   - CC-licensed music
   - Direct downloads
   
5. **Discogs** - 42 results ✅
   - Vinyl & music database
   - Marketplace info

6. **Radio Paradise** - 1 result ✅
   - Curated radio station
   - Shows recent playlist

### Existing Engines
7. **Bandcamp** - 18 results ✅
   - Independent artists
   - Direct support

8. **SoundCloud** - 8 results ✅
   - User uploads
   - Streaming

9. **MixCloud** - 10 results ✅
   - DJ mixes
   - Radio shows

10. **Genius** - 20 results ✅
    - Song lyrics & annotations
    - Artist info

11. **YouTube** - 19 results ✅
    - Music videos
    - Live performances

## ⚠️ Not Returning Results (8 engines)

### Technical Issues
- **Beatport** - Site may have changed
- **Spotify Web** - Dynamic React content
- **Apple Music Web** - Redirect blocking
- **Tidal Web** - Dynamic content
- **Pitchfork** - Redirect blocking
- **MusicToScrape** - Unknown issue
- **AllMusic** - Unknown issue

### Blocked
- **Musixmatch** - CloudFlare 403

## 📊 Summary

- **Total Working**: 11 engines
- **Total Available**: 19 engines attempted
- **Success Rate**: 58%

## Testing Command

```bash
# Test all music engines
python3 test_all_music_engines.py

# Test specific engine
curl "http://localhost:8888/search?q=artist&engines=engine_name&format=json" | jq '.results | length'

# Search all music category
curl "http://localhost:8888/search?q=music&categories=music&format=json" | jq '.results | length'
```