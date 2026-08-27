const moreOverlay = document.querySelector('#moreOverlay');
const openMoreButton = document.querySelector('#openMoreButton');
const closeMoreButton = document.querySelector('#closeMoreButton');

const closeMoreMenu = () => {
    moreOverlay.hidden = true;
    openMoreButton?.focus();
};

openMoreButton?.addEventListener('click', () => {
    moreOverlay.hidden = false;
    closeMoreButton?.focus();
});

closeMoreButton?.addEventListener('click', closeMoreMenu);

moreOverlay?.addEventListener('click', (event) => {
    if (event.target === moreOverlay) {
        closeMoreMenu();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && moreOverlay && !moreOverlay.hidden) {
        closeMoreMenu();
    }
});
