const contactForm = document.querySelector('#contactForm');
const contactStatus = document.querySelector('#contactStatus');

if (contactForm && contactStatus) {
    const setContactMessage = (message, isError = false) => {
        contactStatus.textContent = message;
        contactStatus.className = `mt-4 rounded border px-3 py-2 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-100 text-orange-800'}`;
    };

    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(contactForm);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        const message = formData.get('message').trim();

        if (!name || !email || !message) {
            setContactMessage('Please complete all fields before sending.', true);
            return;
        }

        const subject = encodeURIComponent(`Website enquiry from ${name}`);
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
        setContactMessage('Your email app is opening with the message ready to send.');
        window.location.href = `mailto:terrascope@gmail.com?subject=${subject}&body=${body}`;
        contactForm.reset();
    });
}
