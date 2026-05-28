const fs = require('fs');
const path = require('path');

const DEMO_MP4_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
];

const filePath = path.join(__dirname, 'seed-rich.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove SAFE_YOUTUBE_IDS array and build functions
content = content.replace(
  /const SAFE_YOUTUBE_IDS = \[[\s\S]*?\];/,
  `const DEMO_MP4_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
];`
);

content = content.replace(
  /const buildYouTubeWatchUrl = \(id\) => `https:\/\/www\.youtube\.com\/watch\?v=\$\{id\}`;\nconst buildYouTubeEmbedUrl = \(id\) => `https:\/\/www\.youtube\.com\/embed\/\$\{id\}`;/,
  `const getDemoVideoUrl = (index) => DEMO_MP4_VIDEOS[index % DEMO_MP4_VIDEOS.length];`
);

// Replace all youtube.com/embed/... URLs with demo MP4 URLs
// We need to preserve the structure, so replace each unique embed URL with a rotating demo URL
const embedRegex = /https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]+/g;
const matches = [...content.matchAll(embedRegex)];
let videoIndex = 0;
matches.forEach((match) => {
  const url = DEMO_MP4_VIDEOS[videoIndex % DEMO_MP4_VIDEOS.length];
  content = content.replace(match[0], url);
  videoIndex++;
});

// Replace youtube.com/watch URLs too
const watchRegex = /https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+/g;
const watchMatches = [...content.matchAll(watchRegex)];
watchMatches.forEach((match) => {
  const url = DEMO_MP4_VIDEOS[videoIndex % DEMO_MP4_VIDEOS.length];
  content = content.replace(match[0], url);
  videoIndex++;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ Replaced ${matches.length} embed + ${watchMatches.length} watch URLs with demo MP4s`);
