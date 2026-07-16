// Use the root element so the CSS variables --bg-x and --bg-y work everywhere
const icon = document.querySelector('.floating-icon');
const root = document.documentElement;

let targetX = 50, targetY = 50;
let currentX = 50, currentY = 50;
const ease = 0.05;

window.addEventListener('mousemove', (e) => {
    // Calculate position as a percentage of the window
    targetX = (e.clientX / window.innerWidth) * 100;
    targetY = (e.clientY / window.innerHeight) * 100;
});


function animate() {
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;

    root.style.setProperty('--bg-x', `${currentX}%`);
    root.style.setProperty('--bg-y', `${currentY}%`);

    // --- SHADOW LOGIC ---
    // Calculate how far the mouse is from the center (50%)
    // If mouse is at 100%, shadow move to -10px. If at 0%, shadow move to 10px.
    const shadowX = (50 - currentX) * 0.4; // Adjust 0.4 to change intensity
    const shadowY = (50 - currentY) * 0.4;

    icon.style.setProperty('--shadow-x', `${shadowX}px`);
    icon.style.setProperty('--shadow-y', `${shadowY}px`);

    requestAnimationFrame(animate);
}

animate();

// --- CAROUSEL ---
(function () {
  const carousel = document.querySelector('.screenshots');
  if (!carousel) return;

  // Clone all cards to create the infinite loop
  Array.from(carousel.querySelectorAll('.card')).forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    carousel.appendChild(clone);
  });

  // offsetLeft is relative to the nearest *positioned* ancestor (.main-container),
  // not the carousel, so it includes unrelated offsets. Use getBoundingClientRect()
  // to get the clone's position in viewport space, then convert to scroll-space.
  function loopWidth() {
    const firstClone = carousel.querySelector('[aria-hidden]');
    if (!firstClone) return Math.floor(carousel.scrollWidth / 2);
    const pl = parseFloat(getComputedStyle(carousel).paddingLeft) || 0;
    const cloneLeft   = firstClone.getBoundingClientRect().left;
    const carouselLeft = carousel.getBoundingClientRect().left;
    return Math.round(cloneLeft - carouselLeft + carousel.scrollLeft - pl);
  }

  // --- AUTO-SCROLL ---
  // mouseOver: indefinite hold while cursor is inside; paused: timed hold after interaction
  let mouseOver = false;
  let paused = false;
  let pauseTimer = null;
  let lastTs = 0;
  let started = false;
  const SPEED = 40; // px/sec
  const RESUME_DELAY = 3000; // ms before resuming after wheel/touch/drag

  setTimeout(() => { started = true; }, 1500);

  function pauseTemporarily() {
    paused = true;
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      if (!mouseOver) paused = false;
    }, RESUME_DELAY);
  }

  carousel.addEventListener('mouseenter', () => {
    mouseOver = true;
    paused = true;
    clearTimeout(pauseTimer);
  });

  carousel.addEventListener('mouseleave', () => {
    mouseOver = false;
    pauseTemporarily();
  });

  carousel.addEventListener('wheel', pauseTemporarily, { passive: true });
  carousel.addEventListener('touchstart', pauseTemporarily, { passive: true });

  // --- DRAG TO SCROLL ---
  let dragging = false;
  let dragStartX = 0;
  let dragScrollStart = 0;
  let moved = false;

  // Prevent the browser's native ghost-image drag on images
  carousel.addEventListener('dragstart', e => e.preventDefault());

  carousel.addEventListener('mousedown', (e) => {
    dragging = true;
    moved = false;
    dragStartX = e.pageX;
    dragScrollStart = carousel.scrollLeft;
    carousel.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    pauseTemporarily();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = e.pageX - dragStartX;
    if (Math.abs(delta) > 4) moved = true;
    carousel.scrollLeft = dragScrollStart - delta;
    const lw = loopWidth();
    if (carousel.scrollLeft >= lw) carousel.scrollLeft -= lw;
    if (carousel.scrollLeft < 0) carousel.scrollLeft += lw;
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    carousel.style.cursor = 'grab';
    document.body.style.userSelect = '';
    pauseTemporarily();
  });

  function tick(ts) {
    const lw = loopWidth();
    // Wrap on every frame regardless of pause state — this covers manual
    // wheel/touch scrolls past the boundary without a separate scroll
    // listener that can race with the tick and cause a visible hitch.
    if (!dragging) {
      if (carousel.scrollLeft >= lw) carousel.scrollLeft -= lw;
      else if (carousel.scrollLeft < 0) carousel.scrollLeft += lw;
    }
    if (started && lastTs && !dragging && !paused && !mouseOver) {
      carousel.scrollLeft += SPEED * (ts - lastTs) / 1000;
      if (carousel.scrollLeft >= lw) carousel.scrollLeft -= lw;
    }
    lastTs = ts;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // --- LIGHTBOX ---
  const overlay = document.createElement('div');
  overlay.id = 'lightbox';
  overlay.innerHTML = `
    <div id="lightbox-backdrop"></div>
    <img id="lightbox-img" src="" alt="Screenshot preview">
    <button id="lightbox-close" aria-label="Close">&#x2715;</button>
  `;
  document.body.appendChild(overlay);

  const lbImg = overlay.querySelector('#lightbox-img');
  const lbClose = overlay.querySelector('#lightbox-close');
  const lbBackdrop = overlay.querySelector('#lightbox-backdrop');

  function openLightbox(src) {
    lbImg.src = src;
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  carousel.addEventListener('click', (e) => {
    if (moved) return;
    const img = e.target.closest('.card img');
    if (img) openLightbox(img.src);
  });

  lbClose.addEventListener('click', closeLightbox);
  lbBackdrop.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', () => {
    if (overlay.classList.contains('visible')) closeLightbox();
  });
})();
