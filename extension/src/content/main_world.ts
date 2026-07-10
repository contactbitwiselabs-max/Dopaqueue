// @ts-nocheck
// DopaQueue Main-World Content Script
// Runs in the page's MAIN world (not isolated world) via manifest.json "world": "MAIN".
// This allows direct access to window.ytInitialPlayerResponse and live DOM custom element
// properties (ytd-watch-flexy.__data.playerResponse) which are inaccessible from isolated scripts.

function extractMainWorldPlayerResponse() {
  try {
    // 1. Live DOM element playerResponse (most accurate on SPA navigations)
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const flexyResponse = watchFlexy?.__data?.playerResponse
      || watchFlexy?.playerResponse
      || watchFlexy?.data?.playerResponse;

    if (flexyResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
      return flexyResponse;
    }

    // 2. Movie player instance API
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer && typeof moviePlayer.getPlayerResponse === 'function') {
      const playerResp = moviePlayer.getPlayerResponse();
      if (playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
        return playerResp;
      }
    }

    // 3. Global window variable
    if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
      return window.ytInitialPlayerResponse;
    }

    return flexyResponse || window.ytInitialPlayerResponse || null;
  } catch (err) {
    return null;
  }
}

// Listen for requests from content.js (isolated world)
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;

  if (event.data.type === 'DOPAQUEUE_REQ_MAIN_PLAYER') {
    const playerResponse = extractMainWorldPlayerResponse();
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
    window.postMessage({
      type: 'DOPAQUEUE_RES_MAIN_PLAYER',
      tracks,
      videoId: event.data.videoId
    }, '*');
  }
});

