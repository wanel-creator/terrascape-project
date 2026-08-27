const contactForm = document.querySelector('#contactForm');
const contactStatus = document.querySelector('#contactStatus');

if (contactForm && contactStatus) {
    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(contactForm);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        const message = formData.get('message').trim();

        if (!name || !email || !message) {
            contactStatus.textContent = 'Please complete all fields before sending.';
            contactStatus.className = 'mt-4 text-sm text-red-600';
            return;
        }

        const subject = encodeURIComponent(`Website enquiry from ${name}`);
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
        contactStatus.textContent = 'Your email app is opening with the message ready to send.';
        contactStatus.className = 'mt-4 text-sm text-green-700';
        window.location.href = `mailto:terrascope@gmail.com?subject=${subject}&body=${body}`;
        contactForm.reset();
    });
}
