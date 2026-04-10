/* ============================================================
   MOURA ENGENHARIA | main.js
   - Scroll-driven hero video (desktop + mobile)
   - Form submission (POST -> M² Black webhook)
   - Reveal-on-scroll animations
   - Animated counters in the proof bar
   - Auto-fill UTM hidden fields
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- YEAR IN FOOTER ---------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- SCROLL-DRIVEN HERO VIDEO ----------------
     How it works:
     - The section .hero__scroll-track is 260vh tall.
     - Inside, .hero__sticky is position: sticky, height: 100vh.
     - As the user scrolls past .hero__scroll-track, we map the
       scroll progress (0–1) to video.currentTime (0–duration).
     - We use requestAnimationFrame to smooth the update and lerp
       toward the target time for a fluid feel.
  -----------------------------------------------------------*/
  const track = document.getElementById('hero-track');
  const videoDesktop = document.getElementById('hero-video');
  const videoMobile  = document.getElementById('hero-video-mobile');

  if (track && videoDesktop && videoMobile) {
    // Force the videos to be paused - we control time manually.
    [videoDesktop, videoMobile].forEach((v) => {
      v.pause();
      v.autoplay = false;
      v.loop = false;
      v.muted = true;
      v.playsInline = true;
    });

    const activeVideo = () => (window.innerWidth <= 767 ? videoMobile : videoDesktop);

    // -- Pre-load videos as Blob URLs ------------------------------
    // Many static hosts (Cloudflare Pages included) do NOT serve mp4
    // with reliable HTTP Range support. Without 206 Partial Content
    // responses, video.currentTime = X silently fails for any byte
    // range that hasn't already been streamed in, which kills the
    // scroll-driven scrub effect.
    //
    // Solution: download the entire video file as a Blob via fetch,
    // then assign a blob: URL as the video src. The whole movie now
    // lives in memory and seeks are instant + always succeed,
    // independent of what the origin server does with Range.
    const loadAsBlob = (video, url) =>
      new Promise((resolve) => {
        fetch(url)
          .then((r) => (r && r.ok ? r.blob() : null))
          .then((blob) => {
            if (!blob) return resolve();
            const blobUrl = URL.createObjectURL(blob);
            const onMeta = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              resolve();
            };
            video.addEventListener('loadedmetadata', onMeta);
            video.src = blobUrl;
            video.load();
          })
          .catch(() => resolve());
      });

    const readyPromises = [
      loadAsBlob(videoDesktop, 'assets/video/house-scroll.mp4'),
      loadAsBlob(videoMobile,  'assets/video/house-scroll-mobile.mp4'),
    ];

    let target = 0;
    let current = 0;
    const lerp = 0.18;

    const computeTarget = () => {
      const rect = track.getBoundingClientRect();
      const scrollable = track.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return 0;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      return progress;
    };

    // Guard: only issue a new seek when the previous one has completed.
    // Assigning currentTime while v.seeking === true cancels/queues the
    // prior request and, under high-frequency rAF updates, the video can
    // get stuck in perpetual "seeking" state.
    // Guard against issuing a new seek while the previous one is still in
    // flight - otherwise under high-rate rAF updates Chromium can get stuck
    // in perpetual "seeking" state and currentTime never advances.
    const tick = () => {
      const v = activeVideo();
      if (v && v.duration && !v.seeking) {
        current += (target - current) * lerp;
        const t = current * v.duration;
        if (Math.abs(v.currentTime - t) > 0.03) {
          try { v.currentTime = t; } catch (_) { /* ignore */ }
        }
      }
      requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = computeTarget();
    };

    Promise.all(readyPromises).then(() => {
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      // Nudge first frame so the poster doesn't stay black on iOS.
      // We guard both nudges because a stray seek here can also deadlock.
      try { videoDesktop.currentTime = 0.001; } catch (_) {}
      try { videoMobile.currentTime = 0.001; } catch (_) {}
      requestAnimationFrame(tick);
    });
  }

  /* ---------------- REVEAL ON SCROLL ---------------- */
  const reveals = document.querySelectorAll(
    '.section-title, .section-lead, .pillar, .process__step, .gallery__item, .testimonial, .proof__item, .viability__checks li'
  );
  reveals.forEach((el) => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -60px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------- PROOF COUNTERS ---------------- */
  const counters = document.querySelectorAll('[data-count]');
  const formatNumber = (n) => Math.round(n).toLocaleString('pt-BR');
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const duration = 1400;
          const start = performance.now();
          const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = formatNumber(target * eased);
            if (t < 1) requestAnimationFrame(step);
            else el.textContent = formatNumber(target);
          };
          requestAnimationFrame(step);
          cio.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------------- UTM HIDDEN FIELDS ---------------- */
  try {
    const params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
      const field = document.getElementById(key);
      if (field && params.get(key)) field.value = params.get(key);
    });
  } catch (_) { /* no URLSearchParams in ancient browsers */ }

  /* ---------------- FORM SUBMISSION ---------------- */
  const form = document.getElementById('formulario');
  const feedback = document.getElementById('form-feedback');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!feedback) return;
      feedback.hidden = true;
      feedback.className = 'form__feedback';

      const submitBtn = form.querySelector('button[type="submit"]');
      const origText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      // Simple required validation
      const requiredFields = form.querySelectorAll('[required]');
      let valid = true;
      requiredFields.forEach((f) => {
        if (!f.value.trim()) {
          f.style.borderColor = '#c83232';
          valid = false;
        } else {
          f.style.borderColor = '';
        }
      });
      if (!valid) {
        feedback.textContent = 'Por favor, preencha os campos obrigatórios.';
        feedback.classList.add('form__feedback--error');
        feedback.hidden = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
        return;
      }

      // Build FormData keeping the original Elementor field names
      const fd = new FormData(form);

      try {
        await fetch(form.action, {
          method: 'POST',
          body: fd,
          mode: 'no-cors', // webhooks often respond with CORS-restricted status
        });
        feedback.textContent = 'Recebemos sua solicitação. Em até um dia útil entraremos em contato pelo WhatsApp informado.';
        feedback.classList.add('form__feedback--success');
        feedback.hidden = false;
        form.reset();

        // Optional: push GA / GTM event
        if (window.dataLayer) {
          window.dataLayer.push({ event: 'form_submit', form_id: 'formulario' });
        }
      } catch (err) {
        feedback.textContent = 'Não foi possível enviar. Tente novamente em instantes ou fale conosco no WhatsApp.';
        feedback.classList.add('form__feedback--error');
        feedback.hidden = false;
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
      }
    });
  }
})();
