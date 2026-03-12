// Use the root element so the CSS variables --bg-x and --bg-y work everywhere
const icon = document.querySelector('.floating-icon');
const root = document.documentElement;

let targetX = 50, targetY = 50;
let currentX = 50, currentY = 50;
const ease = 0.05; 

window.addEventListener('mousemove', (e) => {
    // Calculate position as a percentage of the window
    targetX = (e.clientX / window.innerWidth) * 100;
    targetY = (e.clientY / window.innerHeight) * 100;
});

window.addEventListener('deviceorientation', (e) => {
    if (e.beta && e.gamma) {
        targetX = ((e.gamma + 20) / 40) * 100;
        targetY = ((e.beta + 20) / 40) * 100;
    }
});

function animate() {
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;

    root.style.setProperty('--bg-x', `${currentX}%`);
    root.style.setProperty('--bg-y', `${currentY}%`);

    // --- SHADOW LOGIC ---
    // Calculate how far the mouse is from the center (50%)
    // If mouse is at 100%, shadow move to -10px. If at 0%, shadow move to 10px.
    const shadowX = (50 - currentX) * 0.4; // Adjust 0.4 to change intensity
    const shadowY = (50 - currentY) * 0.4;

    icon.style.setProperty('--shadow-x', `${shadowX}px`);
    icon.style.setProperty('--shadow-y', `${shadowY}px`);

    requestAnimationFrame(animate);
}

animate();