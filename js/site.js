export function initializeSite($) {
  setTimeout(() => {
    $('h1.responsive-headline').fitText(1.4, { minFontSize: '16px', maxFontSize: '60px' });
  }, 100);

  $('.smoothscroll').on('click', function (event) {
    event.preventDefault();
    const target = this.hash;
    const $target = $(target);
    $('html, body').stop().animate({ scrollTop: $target.offset().top }, 800, 'swing', () => {
      window.location.hash = target;
    });
  });

  const sections = $('section');
  const navigationLinks = $('#nav-wrap a');
  sections.waypoint({
    handler(event, direction) {
      let activeSection = $(this);
      if (direction === 'up') activeSection = activeSection.prev();
      const activeLink = $(`#nav-wrap a[href="#${activeSection.attr('id')}"]`);
      navigationLinks.parent().removeClass('current');
      activeLink.parent().addClass('current');
    },
    offset: '35%',
  });

  const sizeHeader = () => {
    $('header').css({ height: $(window).height() });
    $('body').css({ width: $(window).width() });
  };
  sizeHeader();
  $(window).on('resize', sizeHeader);

  $(window).on('scroll', () => {
    const headerHeight = $('header').height();
    const scrollTop = $(window).scrollTop();
    const nav = $('#nav-wrap');
    if (scrollTop > headerHeight * 0.2 && scrollTop < headerHeight && $(window).outerWidth() > 768) {
      nav.fadeOut('fast');
    } else if (scrollTop < headerHeight * 0.2) {
      nav.removeClass('opaque').fadeIn('fast');
    } else {
      nav.addClass('opaque').fadeIn('fast');
    }
  });

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
