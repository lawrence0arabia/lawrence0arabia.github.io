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

  // Everything below measures card/image layout to decide how many clone
  // sets are needed for the infinite-scroll wrap to have enough native
  // scroll room (see loopWidth/the safety-loop further down). That decision
  // is made once and never revisited, so it MUST run after the real <img>
  // elements have their true decoded dimensions — not whatever placeholder
  // size exists at the moment this synchronous script happens to execute.
  // Blink and Gecko schedule image decode relative to script execution
  // differently, so "measure now" can silently see different (wrong) sizes
  // per engine — this doesn't depend on network latency at all, it
  // reproduces identically over file:// with zero network involved.
  const cardImages = originalCards.map(card => card.querySelector('img')).filter(Boolean);
  const pending = cardImages.filter(img => !img.complete);
  if (pending.length === 0) {
    initCarousel();
  } else {
    let remaining = pending.length;
    const onSettled = () => {
      remaining--;
      if (remaining <= 0) initCarousel();
    };
    // 'error' too — a broken image must not hang the carousel init forever.
    pending.forEach(img => {
      img.addEventListener('load', onSettled, { once: true });
      img.addEventListener('error', onSettled, { once: true });
    });
  }

  function initCarousel() {
  // Clone the cards on BOTH sides of the originals. A trailing clone set alone
  // only makes rightward scrolling infinite — there's nothing before index 0
  // to reveal, so leftward scrolling hits the native scrollLeft:0 floor and
  // "hits a wall". A leading clone set gives room to scroll left into as well.
  // tabindex=-1 alongside aria-hidden: cloneNode copies the originals'
  // tabindex=0 (added so cards are keyboard-openable), and a hidden-from-
  // assistive-tech element that's still in the Tab order is a real trap for
  // sighted keyboard users — they'd land on a "duplicate" with nothing to
  // announce.
  const afterClones = originalCards.map(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('tabindex', '-1');
    carousel.appendChild(clone);
    return clone;
  });
  const beforeClones = originalCards.map(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('tabindex', '-1');
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

  // The wrap logic below rests on scrollLeft = lw and treats [0, 2*lw] as the
  // safe operating range. That range is only reachable if the carousel's
  // native scroll extent (scrollWidth - clientWidth) actually covers it —
  // otherwise the browser silently clamps scrollLeft short of 2*lw and
  // autoplay stalls dead with no error: the tick loop keeps adding to
  // scrollLeft every frame, but the clamp means it never actually moves.
  // This can happen whenever the viewport is wide relative to the
  // (responsively-sized) card set, so keep adding clone sets on both sides
  // until there's room.
  let safety = 0;
  while (carousel.scrollWidth - carousel.clientWidth < loopWidth() * 2 + 50 && safety < 20) {
    // Anchor captured once per batch, not re-read per card — insertBefore
    // against a moving "current first child" would reverse each batch's
    // card order instead of preserving it.
    const anchor = carousel.firstElementChild;
    originalCards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      carousel.appendChild(clone);
    });
    originalCards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      carousel.insertBefore(clone, anchor);
    });
    safety++;
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
  const SPEED = 40; // px/sec, constant — no ramp up/down
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
    if (started && lastTs && !dragging && !paused && !mouseOver) {
      carousel.scrollLeft += SPEED * (ts - lastTs) / 1000;
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

  // Restores focus to whatever opened the lightbox (a clicked/activated
  // card) once it closes, instead of leaving focus lost on a detached
  // reference or dropped back to <body>.
  let lastFocusedElement = null;

  function openLightbox(src) {
    lastFocusedElement = document.activeElement;
    lbImg.src = src;
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    // Move focus INTO the modal — otherwise it stays wherever it was
    // (often <body>), and the first Tab press goes to background page
    // content still visible behind the overlay instead of anything in it.
    lbClose.focus();
  }

  function closeLightbox() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  carousel.addEventListener('click', (e) => {
    if (moved) return;
    const img = e.target.closest('.card img');
    if (img) openLightbox(img.src);
  });

  // Keyboard-openable: cards carry tabindex=0 (see diamond.html) precisely
  // so this works — Enter/Space activates the focused card the same way a
  // click does. Space also needs preventDefault, or the page scrolls too.
  carousel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card');
    if (!card || card.getAttribute('aria-hidden') === 'true') return;
    e.preventDefault();
    const img = card.querySelector('img');
    if (img) openLightbox(img.src);
  });

  lbClose.addEventListener('click', closeLightbox);
  lbBackdrop.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('visible')) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'Tab') {
      // The close button is the only focusable element in the modal, so
      // trapping focus here just means Tab (or Shift+Tab) can't leave it —
      // without this, Tab escapes to whatever's behind the overlay.
      e.preventDefault();
      lbClose.focus();
    }
  });
  } // end initCarousel
})();
