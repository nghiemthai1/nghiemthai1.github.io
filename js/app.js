import { initializeContactForm } from './contact-form.js?v=20260902-18';
import { initializeSite } from './site.js?v=20260902-18';
import { initializeWorksShowcase } from './works-showcase.js?v=20260902-18';
import { initializeDigitalTwin } from './digital-twin.js?v=20260902-12';

const partialNames = ['header', 'about', 'portfolio', 'testimonials', 'contact', 'footer', 'digital-twin'];
const PARTIAL_REVISION = '20260902-1';

async function loadPartial(name) {
  const url = new URL(`../partials/${name}.html`, import.meta.url);
  url.searchParams.set('v', PARTIAL_REVISION);
  url.searchParams.set('v', '20260902-18');
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Unable to load ${url.pathname} (${response.status})`);
  }

  return response.text();
}

async function start() {
  const mountPoint = document.querySelector('#site-content');

  try {
    const partials = await Promise.all(partialNames.map(loadPartial));
    mountPoint.replaceChildren();
    mountPoint.insertAdjacentHTML('beforeend', partials.join('\n'));

    initializeContactForm();
    initializeWorksShowcase();
    initializeSite(window.jQuery);
    await initializeDigitalTwin();
  } catch (error) {
    console.error(error);
    mountPoint.innerHTML = '<p class="site-load-error" role="alert">The site could not be loaded. Please refresh the page.</p>';
  }
}

start();
