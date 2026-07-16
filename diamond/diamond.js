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

  const originalCards = Array.from(carousel.querySelectorAll('.card'));
  if (originalCards.length === 0) return;

  // Clone the cards on BOTH sides of the originals. A trailing clone set alone
  // only makes rightward scrolling infinite — there's nothing before index 0
  // to reveal, so leftward scrolling hits the native scrollLeft:0 floor and
  // "hits a wall". A leading clone set gives room to scroll left into as well.
  const afterClones = originalCards.map(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    carousel.appendChild(clone);
    return clone;
  });
  const beforeClones = originalCards.map(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  beforeClones.forEach(clone => carousel.insertBefore(clone, originalCards[0]));

  // Width of one full set of cards (gap included), measured as the distance
  // between the start of the original set and the start of the after-clone
  // set. This is scroll-offset independent since both move together as the
  // carousel scrolls, so no scrollLeft/padding correction is needed.
  function loopWidth() {
    return Math.round(afterClones[0].getBoundingClientRect().left - originalCards[0].getBoundingClientRect().left);
  }

  // Rest on the real (original) set, with a full loop's worth of cloned
  // content on either side to scroll into before a wrap is needed.
  carousel.scrollLeft = loopWidth();

  // --- AUTO-SCROLL ---
  // mouseOver: indefinite hold while cursor is inside; paused: timed hold after interaction
  let mouseOver = false;
  let paused = false;
  let pauseTimer = null;
  let lastTs = 0;
  let started = false;
  let currentSpeed = 0;
  // S-curve transition state: currentSpeed glides from speedFrom to speedTo
  // over speedTransitionDuration, following an easing curve with zero
  // velocity AND zero acceleration at both ends — so it starts almost
  // imperceptibly, picks up through the middle, then settles in gently,
  // rather than snapping into motion or decelerating like a car braking.
  let speedFrom = 0;
  let speedTo = 0;
  let speedTransitionStart = 0;
  let speedTransitionDuration = 0;
  const SPEED = 40; // px/sec, cruising speed once fully ramped up
  const RAMP_DURATION = 2200; // ms for a full 0 -> SPEED (or SPEED -> 0) transition
  const RESUME_DELAY = 3000; // ms before resuming after wheel/touch/drag

  // Smootherstep: zero 1st AND 2nd derivative at t=0 and t=1, for a curve
  // that ramps up from and back down to a true standstill, not just a lerp.
  function easeInOutCurve(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // Cuts the current speed to zero instantly, bypassing the S-curve — used
  // when the user takes direct manual control (drag/wheel/touch), where any
  // lingering auto-scroll motion would fight with their input.
  function stopImmediately() {
    currentSpeed = 0;
    speedFrom = 0;
    speedTo = 0;
    speedTransitionDuration = 0;
  }

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

  carousel.addEventListener('wheel', () => { stopImmediately(); pauseTemporarily(); }, { passive: true });
  carousel.addEventListener('touchstart', () => { stopImmediately(); pauseTemporarily(); }, { passive: true });

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
    stopImmediately();
    pauseTemporarily();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = e.pageX - dragStartX;
    if (Math.abs(delta) > 4) moved = true;
    carousel.scrollLeft = dragScrollStart - delta;
    const lw = loopWidth();
    if (carousel.scrollLeft >= lw * 2) carousel.scrollLeft -= lw;
    if (carousel.scrollLeft <= 0) carousel.scrollLeft += lw;
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
      if (carousel.scrollLeft >= lw * 2) carousel.scrollLeft -= lw;
      else if (carousel.scrollLeft <= 0) carousel.scrollLeft += lw;
    }
    // Glide toward the target speed (SPEED once cruising, 0 while stopped/
    // paused/dragging) along an S-curve instead of snapping, so starts and
    // stops ease in and out smoothly rather than jumping to full speed.
    const targetSpeed = (started && !dragging && !paused && !mouseOver) ? SPEED : 0;
    if (targetSpeed !== speedTo) {
      // Direction changed — start a fresh transition from wherever the
      // speed currently is. Scale the duration to the remaining distance
      // so a transition interrupted partway through doesn't restart at
      // full RAMP_DURATION for what's now a much shorter distance to cover.
      speedFrom = currentSpeed;
      speedTo = targetSpeed;
      speedTransitionDuration = RAMP_DURATION * (Math.abs(speedTo - speedFrom) / SPEED);
      speedTransitionStart = ts;
    }
    const elapsed = ts - speedTransitionStart;
    const t = speedTransitionDuration > 0 ? Math.min(1, elapsed / speedTransitionDuration) : 1;
    currentSpeed = speedFrom + (speedTo - speedFrom) * easeInOutCurve(t);
    if (lastTs && !dragging) {
      carousel.scrollLeft += currentSpeed * (ts - lastTs) / 1000;
      if (carousel.scrollLeft >= lw * 2) carousel.scrollLeft -= lw;
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
