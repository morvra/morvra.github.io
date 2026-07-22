document.addEventListener('click', (e) => {
    const toggle = e.target.closest('#nav-toggle');
    if (toggle) {
        const nav = document.getElementById('site-nav');
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        return;
    }
    if (!e.target.closest('#site-nav') && !e.target.closest('#nav-toggle')) {
        const nav = document.getElementById('site-nav');
        if (nav) {
            nav.classList.remove('open');
            document.getElementById('nav-toggle')?.setAttribute('aria-expanded', 'false');
        }
    }
});

window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 4);
    }
});