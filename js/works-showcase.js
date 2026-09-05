const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export function initializeWorksShowcase() {
  const scene = document.querySelector('[data-works-scene]');
  if (!scene) return;

  const viewport = scene.querySelector('[data-works-viewport]');
  const track = scene.querySelector('[data-works-track]');
  const preferredOrder = [
    'Professional Experience',
    'Electrical & Computer Engineering',
    'Software Development',
    'Machine Learning & Computer Vision',
    'Multidisciplinary Systems Design',
  ];
  const panelLookup = new Map(
    [...track.querySelectorAll('[data-work-panel]')].map((panel) => [panel.dataset.category, panel]),
  );
  preferredOrder.forEach((category) => {
    const panel = panelLookup.get(category);
    if (panel) track.append(panel);
  });
  const panels = [...track.querySelectorAll('[data-work-panel]')];
  const previousButton = scene.querySelector('[data-works-previous]');
  const nextButton = scene.querySelector('[data-works-next]');
  const currentLabel = scene.querySelector('[data-works-current]');
  const titleLabel = scene.querySelector('[data-works-title]');
  const progressBar = scene.querySelector('[data-works-progress]');
  const categoryButtons = [...scene.querySelectorAll('[data-works-jump]')];
  const mobileQuery = window.matchMedia('(max-width: 900px)');
  const stackedQuery = window.matchMedia('(max-width: 700px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let activeIndex = 0;
  let sceneTop = 0;
  let horizontalTravel = 0;
  let verticalTravel = 0;
  let frameRequested = false;

  const isReduced = () => reducedMotionQuery.matches;
  const isStacked = () => stackedQuery.matches && !isReduced();
  const isNativeScroll = () => mobileQuery.matches && !isReduced() && !isStacked();

  function setActivePanel(index) {
    const nextIndex = clamp(index, 0, panels.length - 1);
    if (nextIndex !== activeIndex) activeIndex = nextIndex;

    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle('is-active', panelIndex === activeIndex);
    });
    categoryButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeIndex;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    currentLabel.textContent = String(activeIndex + 1).padStart(2, '0');
    titleLabel.textContent = panels[activeIndex].dataset.category;
    previousButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === panels.length - 1;
  }

  function findClosestPanel(scrollPosition, nativeScroll = false) {
    const viewportCenter = viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    panels.forEach((panel, index) => {
      const panelCenter = panel.offsetLeft - scrollPosition + panel.offsetWidth / 2;
      const distance = Math.abs(panelCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }

      if (!isReduced()) {
        const parallax = clamp((viewportCenter - panelCenter) * 0.08, -52, 52);
        panel.style.setProperty('--parallax-x', `${parallax}px`);
      }
    });

    setActivePanel(closestIndex);

    const availableTravel = nativeScroll
      ? Math.max(track.scrollWidth - track.clientWidth, 1)
      : Math.max(horizontalTravel, 1);
    progressBar.style.transform = `scaleX(${clamp(scrollPosition / availableTravel, 0, 1)})`;
  }

  function renderDesktop() {
    frameRequested = false;
    if (isStacked()) {
      const viewportCenter = window.innerHeight / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      panels.forEach((panel, index) => {
        const bounds = panel.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - viewportCenter);
        panel.style.removeProperty('--parallax-x');
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActivePanel(closestIndex);
      progressBar.style.transform = `scaleX(${closestIndex / Math.max(panels.length - 1, 1)})`;
      return;
    }
    if (isNativeScroll() || isReduced()) return;

    const progress = verticalTravel
      ? clamp((window.scrollY - sceneTop) / verticalTravel, 0, 1)
      : 0;
    const translateX = horizontalTravel * progress;

    track.style.transform = `translate3d(${-translateX}px, 0, 0)`;
    findClosestPanel(translateX);
  }

  function requestDesktopRender() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(renderDesktop);
  }

  function renderNativeScroll() {
    if (!isNativeScroll()) return;
    findClosestPanel(track.scrollLeft, true);
  }

  function measure() {
    track.style.transform = '';
    scene.style.height = '';

    if (isReduced()) {
      panels.forEach((panel) => panel.style.removeProperty('--parallax-x'));
      progressBar.style.transform = 'scaleX(1)';
      setActivePanel(0);
      return;
    }

    if (isStacked()) {
      panels.forEach((panel) => panel.style.removeProperty('--parallax-x'));
      requestDesktopRender();
      return;
    }

    if (isNativeScroll()) {
      horizontalTravel = Math.max(track.scrollWidth - track.clientWidth, 0);
      window.requestAnimationFrame(renderNativeScroll);
      return;
    }

    horizontalTravel = Math.max(track.scrollWidth - viewport.clientWidth, 0);
    const stickyOffset = Number.parseFloat(window.getComputedStyle(viewport).top) || 0;
    const viewportHeight = viewport.clientHeight;
    scene.style.height = `${viewportHeight + horizontalTravel}px`;
    sceneTop = scene.getBoundingClientRect().top + window.scrollY - stickyOffset;
    verticalTravel = Math.max(scene.offsetHeight - viewportHeight, 1);
    requestDesktopRender();
  }

  function scrollToPanel(index) {
    const targetIndex = clamp(index, 0, panels.length - 1);
    const panel = panels[targetIndex];
    const behavior = isReduced() ? 'auto' : 'smooth';

    if (isReduced()) {
      setActivePanel(targetIndex);
      panel.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    if (isStacked()) {
      setActivePanel(targetIndex);
      panel.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const targetX = clamp(
      panel.offsetLeft + panel.offsetWidth / 2 - viewport.clientWidth / 2,
      0,
      horizontalTravel,
    );

    if (isNativeScroll()) {
      track.scrollTo({ left: targetX, behavior });
      return;
    }

    const targetY = sceneTop + (targetX / Math.max(horizontalTravel, 1)) * verticalTravel;
    window.scrollTo({ top: targetY, behavior });
  }

  previousButton.addEventListener('click', () => scrollToPanel(activeIndex - 1));
  nextButton.addEventListener('click', () => scrollToPanel(activeIndex + 1));
  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => scrollToPanel(Number(button.dataset.worksJump)));
  });

  viewport.addEventListener('keydown', (event) => {
    if (event.target.closest('a, button')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollToPanel(activeIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollToPanel(activeIndex + 1);
    }
  });

  window.addEventListener('scroll', requestDesktopRender, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure, { once: true });
  track.addEventListener('scroll', () => window.requestAnimationFrame(renderNativeScroll), { passive: true });
  mobileQuery.addEventListener('change', measure);
  stackedQuery.addEventListener('change', measure);
  reducedMotionQuery.addEventListener('change', measure);

  setActivePanel(0);
  window.requestAnimationFrame(measure);
}
