export function initializeSite($) {
  const home = document.querySelector('#home');
  const portrait = document.querySelector('.home-portrait-frame');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const updateHomeState = () => {
    document.body.classList.toggle('home-in-view', Boolean(home && home.getBoundingClientRect().bottom > 80));
  };
  updateHomeState();
  $(window).on('scroll resize', updateHomeState);

  let portraitLightFrame = 0;
  const updatePortraitLight = () => {
    portraitLightFrame = 0;
    if (!home || !portrait) return;
    if (reduceMotion.matches) {
      portrait.style.setProperty('--portrait-light-angle', '0deg');
      return;
    }

    const scrollRange = Math.max(home.offsetHeight * .85, 1);
    const progress = Math.max(0, Math.min(1, -home.getBoundingClientRect().top / scrollRange));
    portrait.style.setProperty('--portrait-light-angle', `${(progress * 220).toFixed(2)}deg`);
  };
  const requestPortraitLight = () => {
    if (!portraitLightFrame) portraitLightFrame = window.requestAnimationFrame(updatePortraitLight);
  };
  updatePortraitLight();
  $(window).on('scroll resize', requestPortraitLight);
  reduceMotion.addEventListener?.('change', requestPortraitLight);

  const about = document.querySelector('#about');
  let aboutParallaxFrame = 0;
  const updateAboutParallax = () => {
    aboutParallaxFrame = 0;
    if (!about || reduceMotion.matches) {
      about?.style.setProperty('--about-parallax-y', '0px');
      return;
    }
    const rect = about.getBoundingClientRect();
    const rise = Math.max(0, Math.min(window.innerWidth < 768 ? 34 : 64, (window.innerHeight - rect.top) * .11));
    about.style.setProperty('--about-parallax-y', `${-rise.toFixed(2)}px`);
  };
  const requestAboutParallax = () => {
    if (!aboutParallaxFrame) aboutParallaxFrame = window.requestAnimationFrame(updateAboutParallax);
  };
  updateAboutParallax();
  $(window).on('scroll resize', requestAboutParallax);
  reduceMotion.addEventListener?.('change', requestAboutParallax);

  setTimeout(() => {
    $('h1.responsive-headline').fitText(1.4, { minFontSize: '16px', maxFontSize: '60px' });
  }, 100);

  $('.smoothscroll').on('click', function (event) {
    event.preventDefault();
    const target = this.hash;
    const $target = $(target);
    const navigationHeight = Math.min(document.querySelector('#nav-wrap')?.getBoundingClientRect().height ?? 0, 56);
    const targetTop = Math.max(0, $target.offset().top - navigationHeight);
    window.location.hash = target;
    $('html, body').stop().animate({ scrollTop: targetTop }, 800, 'swing');
  });

  const navigationLinks = [...document.querySelectorAll('#nav a[href^="#"]')];
  const navigationSections = navigationLinks.map(link => ({ link, section: document.querySelector(link.hash) })).filter(item => item.section);
  const updateActiveNavigation = () => {
    const threshold = Math.min(window.innerHeight * .35, 240);
    let active = navigationSections[0];
    for (const item of navigationSections) {
      if (item.section.getBoundingClientRect().top <= threshold) active = item;
    }
    for (const item of navigationSections) {
      const current = item === active;
      item.link.parentElement.classList.toggle('current', current);
      if (current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  };
  updateActiveNavigation();
  $(window).on('scroll resize', updateActiveNavigation);

  const updateNavigationSurface = () => {
    document.querySelector('#nav-wrap').classList.toggle('opaque', window.scrollY > 32);
  };
  updateNavigationSurface();
  $(window).on('scroll', updateNavigationSurface);

  $('.item-wrap a').magnificPopup({
    type: 'inline',
    fixedContentPos: false,
    removalDelay: 200,
    showCloseBtn: false,
    mainClass: 'mfp-fade',
  });
  $(document).on('click', '.popup-modal-dismiss', (event) => {
    event.preventDefault();
    $.magnificPopup.close();
  });

  $('.flexslider').flexslider({
    namespace: 'flex-',
    controlsContainer: '.flex-container',
    animation: 'slide',
    controlNav: true,
    directionNav: false,
    smoothHeight: true,
    slideshowSpeed: 7000,
    animationSpeed: 600,
    randomize: false,
  });

}
