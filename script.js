// FONTO — stacked-slide scroll effect
//
// PART 1: visual stacking.
// Each .slide is `position: sticky; top:0; height:100vh`. As the NEXT
// slide's top edge rises from the bottom of the viewport to 0, we use that
// as a 0→1 progress value to smoothly scale down / dim / lift the CURRENT
// (outgoing) slide, so it feels like the new slide is stacking on top of
// it rather than just cutting over it. This is purely visual — it never
// touches scroll position, so it can't fight the user's input.
//
// PART 2: pacing.
// Rather than hijacking the wheel event (which made scrolling feel heavy
// and unresponsive, and blocked the internal footer scroll on mobile),
// pacing now comes entirely from native CSS `scroll-snap`. The browser's
// own snap implementation is what stays smooth and responsive in both
// directions — see style.css for the snap rules and the touch-device
// override that disables snapping so mobile scrolling is never interrupted.
//
// PART 3: nav-counter clicks still jump one slide at a time, using the
// native, interruptible `scrollIntoView` instead of a custom rAF tween.

(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  let ticking = false;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function updateStack() {
    const vh = window.innerHeight;

    for (let i = 0; i < slides.length - 1; i++) {
      const current = slides[i];
      const next = slides[i + 1];
      const nextTop = next.getBoundingClientRect().top;

      // progress: 0 when next slide hasn't arrived yet, 1 when it fully covers
      const progress = clamp01(1 - nextTop / vh);

      const scale = 1 - progress * 0.08;      // 1 -> 0.92
      const translateY = -progress * 28;       // 0 -> -28px (slight lift/recede)
      const brightness = 1 - progress * 0.35;  // 1 -> 0.65
      const opacityDim = 1 - progress * 0.25;  // subtle fade, never fully gone

      current.style.transform = `scale(${scale}) translateY(${translateY}px)`;
      current.style.filter = `brightness(${brightness})`;
      current.style.opacity = opacityDim;
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateStack);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateStack();

  // "↓ / ↑" counters advance the deck by exactly one slide.
  document.querySelectorAll('.slide-counter').forEach((counter, idx) => {
    counter.addEventListener('click', () => goToSlideIndex(idx + 2));
  });

  /* ------------------------------------------------------------------ */
  /* Site navigation — logo, header menu, in-page CTAs, reservation form */
  /* ------------------------------------------------------------------ */

  // 1-based slide number (matches the "N/5" labels already used on the
  // counters) -> smooth scroll to that slide.
  //
  // Three things fight a plain `element.scrollIntoView()` here: (1)
  // `scroll-snap-stop: always` on .slide forces a *programmatic* scroll
  // spanning more than one slide (e.g. the logo jumping from Slide 5 back
  // to Slide 1) to stop at the very next slide instead of continuing to
  // the real target; (2) since every .slide is `position: sticky`, both
  // `scrollIntoView` and `getBoundingClientRect()`/`offsetTop` report
  // unreliable geometry for a sticky element once you've scrolled past
  // its own flow region — the browser keeps reporting it near its last
  // "stuck" position rather than its true document offset. Since every
  // slide is a fixed `100vh` tall, its true offset is just its index
  // times the viewport height — no geometry queries needed, so this
  // sidesteps the sticky quirk entirely. Snapping is disabled just for
  // the duration of the animated scroll and restored once it's settled.
  let snapRestoreTimer = null;
  function goToSlideIndex(oneBasedIndex) {
    const target = slides[oneBasedIndex - 1];
    if (!target) return;
    const html = document.documentElement;
    if (snapRestoreTimer) window.clearTimeout(snapRestoreTimer);
    html.style.scrollSnapType = 'none';
    window.scrollTo({ top: (oneBasedIndex - 1) * window.innerHeight, behavior: 'smooth' });
    // Re-enabling snap while the smooth scroll is still animating makes
    // the snap engine grab the still-moving scroll and stop it early, so
    // this waits comfortably longer than a worst-case (full 4-slide)
    // smooth-scroll animation takes to finish before restoring it.
    snapRestoreTimer = window.setTimeout(() => {
      html.style.scrollSnapType = '';
    }, 1600);
  }

  // Logo always returns to Slide 1 (Hero). It's an <img role="button">, so
  // clicks and keyboard activation (Enter/Space) both need to work.
  const logo = document.getElementById('logoHome');
  if (logo) {
    logo.addEventListener('click', () => goToSlideIndex(1));
    logo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToSlideIndex(1);
      }
    });
  }

  // Any button/link with data-nav="N" jumps to slide N.
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      goToSlideIndex(parseInt(el.getAttribute('data-nav'), 10));
    });
  });

  // Slide 2 "Contact" — go to Slide 5, then also scroll its internal
  // content all the way down so the footer (contact details) is in view,
  // not just the top of the slide.
  document.querySelectorAll('[data-action="contact-footer"]').forEach((el) => {
    el.addEventListener('click', () => {
      const content = document.querySelector('.slide5-content');
      goToSlideIndex(5);
      window.setTimeout(() => {
        if (content) content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
      }, 1700); // wait for the outer smooth-scroll to fully settle first
    });
  });

  /* ---- Header "MENU" — full-screen navigation overlay ---- */
  const menuToggle = document.getElementById('menuToggle');
  const navOverlay = document.getElementById('navOverlay');
  const navClose = document.getElementById('navClose');

  function openNav() {
    if (!navOverlay) return;
    navOverlay.classList.add('is-open');
    navOverlay.setAttribute('aria-hidden', 'false');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'true');
      const label = menuToggle.querySelector('span');
      if (label) label.textContent = 'CLOSE';
    }
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    if (!navOverlay) return;
    navOverlay.classList.remove('is-open');
    navOverlay.setAttribute('aria-hidden', 'true');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      const label = menuToggle.querySelector('span');
      if (label) label.textContent = 'MENU';
    }
    document.body.style.overflow = '';
  }
  if (menuToggle && navOverlay) {
    menuToggle.addEventListener('click', () => {
      if (navOverlay.classList.contains('is-open')) closeNav();
      else openNav();
    });
  }
  if (navClose) navClose.addEventListener('click', closeNav);
  if (navOverlay) {
    navOverlay.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        closeNav();
        const navTarget = link.getAttribute('data-nav');
        const action = link.getAttribute('data-action');
        window.setTimeout(() => {
          if (navTarget) goToSlideIndex(parseInt(navTarget, 10));
          else if (action === 'call-us') goToSlideIndex(5);
        }, 250); // let the overlay finish closing before the page scrolls
      });
    });
  }

  /* ---- Slide 4 "Complete an Online Form" — reservation modal ---- */
  const openReservationBtn = document.getElementById('openReservationModal');
  const reservationModal = document.getElementById('reservationModal');
  const reservationClose = document.getElementById('reservationClose');
  const reservationForm = document.getElementById('reservationForm');
  const reservationSuccess = document.getElementById('resSuccess');

  function openReservationModal() {
    if (!reservationModal) return;
    reservationModal.classList.add('is-open');
    reservationModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeReservationModal() {
    if (!reservationModal) return;
    reservationModal.classList.remove('is-open');
    reservationModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Reset to a fresh form for next time, once the close transition ends.
    window.setTimeout(() => {
      if (reservationForm) {
        reservationForm.reset();
        reservationForm.style.display = '';
      }
      if (reservationSuccess) reservationSuccess.hidden = true;
    }, 500);
  }
  if (openReservationBtn) openReservationBtn.addEventListener('click', openReservationModal);
  if (reservationClose) reservationClose.addEventListener('click', closeReservationModal);
  if (reservationModal) {
    reservationModal.addEventListener('click', (e) => {
      if (e.target === reservationModal) closeReservationModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeNav();
    closeReservationModal();
  });

  // Client-side validation + inline confirmation. There's no booking
  // backend wired up yet, so submitting just confirms the request was
  // captured — swap this handler for a real API/email call when ready.
  if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!reservationForm.checkValidity()) {
        reservationForm.reportValidity();
        return;
      }
      reservationForm.style.display = 'none';
      if (reservationSuccess) reservationSuccess.hidden = false;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Slide 5 — infinite auto-scrolling gallery (marquee)                 */
  /*                                                                     */
  /* The track's photo set is duplicated once so there are always two   */
  /* identical copies back to back. Every frame we nudge scrollLeft      */
  /* forward by a small constant amount; whenever that position reaches */
  /* the end of the first copy we silently subtract one copy-width,     */
  /* landing on the pixel-identical start of the second copy — an       */
  /* invisible wrap, so the loop plays forever with no visible seam.    */
  /*                                                                     */
  /* Manual drag / wheel / touch scrolling is never paused or blocked:  */
  /* it changes the same scrollLeft the automation reads and writes, so */
  /* the two simply add together and the auto-scroll picks right back   */
  /* up from wherever the user leaves it, with no resume delay.         */
  /* ------------------------------------------------------------------ */
  const track = document.querySelector('.gallery-track');
  if (track) {
    const SPEED = 0.45; // px per frame (~27px/s at 60fps — smooth, constant)

    // Duplicate the photo set so the loop has a seamless second copy to
    // scroll into. Clones are hidden from assistive tech.
    const originalChildren = Array.from(track.children);
    originalChildren.forEach((child) => {
      const clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    // Measured after the browser has laid out the (now-doubled) track.
    let setWidth = 0;
    function measure() {
      setWidth = track.scrollWidth / 2;
    }
    measure();
    window.addEventListener('resize', measure);

    // Click-and-drag scrolling for desktop mouse users (native overflow-x
    // only responds to trackpad/touch gestures, not mouse drag).
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartScroll = track.scrollLeft;
        track.setPointerCapture(e.pointerId);
        track.style.cursor = 'grabbing';
      }
    });
    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      track.scrollLeft = dragStartScroll - (e.clientX - dragStartX);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
      track.addEventListener(evt, () => {
        isDragging = false;
        track.style.cursor = '';
      });
    });

    // `scrollLeft` is an integer pixel value in most browsers — reading it
    // back and adding a sub-pixel SPEED to it (as this used to do) rounds
    // 0.45 down to 0 every single frame, so the auto-scroll never actually
    // moves. Tracking position in this separate float instead of trusting
    // scrollLeft's own memory fixes that: the fractional progress
    // accumulates correctly here even though the browser keeps rounding
    // what it displays.
    let pos = track.scrollLeft;

    function tick() {
      if (setWidth > 0) {
        if (isDragging) {
          // Manual drag writes scrollLeft directly; keep our accumulator
          // in sync so auto-scroll resumes exactly where the user leaves
          // off, with no jump and no dead zone.
          pos = track.scrollLeft;
        } else {
          pos += SPEED;
          track.scrollLeft = pos;
        }

        // Seamless wrap — keeps working no matter whether the position
        // moved via auto-scroll, wheel, touch, or the drag handler above.
        if (pos >= setWidth) {
          pos -= setWidth;
          track.scrollLeft = pos;
          if (isDragging) dragStartScroll -= setWidth;
        } else if (pos < 0) {
          pos += setWidth;
          track.scrollLeft = pos;
          if (isDragging) dragStartScroll += setWidth;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
