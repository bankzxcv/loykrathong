(() => {
  const audio = document.querySelector('#background-music');
  const toggle = document.querySelector('.music');
  const message = document.querySelector('.music-status');
  const retry = new AbortController();

  audio.volume = 0.35;

  function update() {
    toggle.setAttribute('aria-pressed', String(!audio.paused));
  }

  async function play() {
    message.textContent = '';
    try {
      await audio.play();
    } catch (error) {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        message.textContent = 'Music is unavailable.';
      }
    } finally {
      update();
    }
  }

  function startAfterInteraction(event) {
    if (event.target instanceof Node && toggle.contains(event.target)) return;
    play();
  }

  document.addEventListener('pointerup', startAfterInteraction, {signal: retry.signal});
  document.addEventListener('keydown', startAfterInteraction, {signal: retry.signal});
  toggle.addEventListener('click', () => {
    retry.abort();
    if (audio.paused) {
      play();
    } else {
      audio.pause();
      update();
    }
  });

  audio.addEventListener('playing', () => {
    retry.abort();
    update();
  });
  audio.addEventListener('pause', update);
  play();
})();
