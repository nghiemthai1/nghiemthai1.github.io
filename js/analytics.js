window.dataLayer = window.dataLayer || [];

const analyticsScript = document.createElement('script');
analyticsScript.async = true;
analyticsScript.src = 'https://www.googletagmanager.com/gtag/js?id=UA-152960324-1';
document.head.append(analyticsScript);

window.gtag = function gtag() {
  window.dataLayer.push(arguments);
};

window.gtag('js', new Date());
window.gtag('config', 'UA-152960324-1');
