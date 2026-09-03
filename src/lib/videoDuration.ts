// Reads a video file's actual length client-side (via a throwaway <video>
// element) before ever uploading it - a real length check rather than a
// blunt file-size proxy, since a well-compressed 10-minute clip and a
// poorly-compressed 30-second one can be the same size.
export function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read this video file."));
    };
  });
}

export const MAX_VIDEO_DURATION_SECONDS = 10 * 60;
// A generous sanity backstop, not the real limit - the actual limit is
// duration. Big enough that even a high-quality 10-minute clip fits.
export const MAX_VIDEO_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

export async function validateVideoFile(file: File): Promise<string | null> {
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return "Video is too large (over 2GB).";
  }
  try {
    const duration = await getVideoDurationSeconds(file);
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      return "Video must be 10 minutes or under.";
    }
  } catch {
    return "Couldn't read this video file - try a different one.";
  }
  return null;
}
