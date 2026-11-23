(() => {
  const scene = document.querySelector('main');
  const toggle = document.querySelector('.fullscreen');
  const viewport = window.visualViewport;
  let fallback = false;
  let scrollTop = 0;

  function sizeView() {
    if (!fallback || !viewport) return;
    scene.style.setProperty('--view-height', viewport.height + 'px');
    scene.style.setProperty('--view-top', viewport.offsetTop + 'px');
  }

  function update() {
    const active = fallback || document.fullscreenElement === scene;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.querySelector('span').textContent = active ? 'ออกจากเต็มจอ' : 'เต็มจอ';
    toggle.querySelector('path').setAttribute('d', active
      ? 'M9 4v5H4m16 0h-5V4m0 16v-5h5M4 15h5v5'
      : 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5');
    if (!active) {
      window.scrollTo(0, scrollTop);
      toggle.focus({preventScroll: true});
    }
  }

  function setFallback(active) {
    fallback = active;
    scene.classList.toggle('immersive', active);
    document.documentElement.classList.toggle('immersive', active);
    sizeView();
    update();
  }

  toggle.addEventListener('click', async () => {
    if (fallback) return setFallback(false);
    if (document.fullscreenElement === scene) return document.exitFullscreen();
    scrollTop = window.scrollY;
    if (scene.requestFullscreen && document.fullscreenEnabled) {
      try {
        await scene.requestFullscreen();
        return;
      } catch { /* Use the visible viewport when native fullscreen is denied. */ }
    }
    setFallback(true);
  });
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('keydown', event => {
    if (fallback && event.key === 'Escape') setFallback(false);
  });
  viewport?.addEventListener('resize', sizeView);
  viewport?.addEventListener('scroll', sizeView);
})();
