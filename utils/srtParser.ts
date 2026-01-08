export interface SrtSubtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

function timecodeToSeconds(timecode: string): number {
  const parts = timecode.split(/[:,]/);
  if (parts.length !== 4) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3], 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function parseSrt(srtContent: string): SrtSubtitle[] {
  const subtitles: SrtSubtitle[] = [];
  // Normalize line endings and split into blocks
  const blocks = srtContent.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let lineIndex = 0;
    
    // The first line might be the sequence number, but it could be missing.
    // We check if the second line is a timecode. If not, maybe the first line is.
    const potentialTimecodeLine = lines[lineIndex].includes('-->') ? lines[lineIndex] : lines[lineIndex + 1];

    if (!potentialTimecodeLine || !potentialTimecodeLine.includes('-->')) {
        continue;
    }
    
    const timeMatch = potentialTimecodeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!timeMatch) continue;

    // Adjust line index based on where timecode was found
    if (potentialTimecodeLine === lines[lineIndex]) {
        lineIndex++;
    } else {
        lineIndex += 2;
    }
    
    const startTime = timecodeToSeconds(timeMatch[1].replace('.', ','));
    const endTime = timecodeToSeconds(timeMatch[2].replace('.', ','));
    const text = lines.slice(lineIndex).join(' ').trim();

    if (text) {
      subtitles.push({ id: subtitles.length + 1, startTime, endTime, text });
    }
  }
  return subtitles;
}