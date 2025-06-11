# Sample Videos Directory

This directory contains sample video files that can be used for testing the Queen Track system without using live camera feeds.

## Adding Your Video

1. Place your sample video file in this directory
2. Name it `sample-hive-video.mp4` (or update the filename in the HomePage.jsx file)
3. Recommended video specifications:
   - Format: MP4 (H.264 codec recommended)
   - Frame rate: 30fps or similar to your actual cameras
   - Resolution: Match your camera resolution for consistency
   - Duration: Any length (video will loop automatically)

## Usage

- Select "שידור קובץ וידאו לדוגמה" (Sample Video Broadcasting) in the home page
- Click "התחל שידור וידאו" (Start Video Broadcasting)
- The video will play in a loop and be streamed to the backend for processing
- This allows you to test the bee detection system without live cameras

## File Structure

```
public/sample-videos/
├── README.md (this file)
└── sample-hive-video.mp4 (your video file - add this)
```

## Notes

- The video file is served directly from the public directory
- Videos are played with audio muted to comply with browser autoplay policies
- The video will automatically loop when it reaches the end
- Both the video playback and WebSocket streaming to the backend work simultaneously
