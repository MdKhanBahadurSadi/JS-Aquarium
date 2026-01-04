/**
 * CONFIGURATION
 */
const TANK_COLORS = {
    day: { top: '#006994', bottom: '#001e36', sand: '#e6c288' },
    night: { top: '#001219', bottom: '#000000', sand: '#3d342b' }
};

const FISH_TYPES = [
    { name: 'Goldfish', color: '#FFD700', finColor: '#FF8C00', speed: 2, size: 15, turnSpeed: 0.05 },
    { name: 'Neon Tetra', color: '#00FFFF', finColor: '#FF0000', speed: 3.5, size: 8, turnSpeed: 0.08 },
    { name: 'Angelfish', color: '#C0C0C0', finColor: '#000000', speed: 1.5, size: 20, turnSpeed: 0.03, tall: true },
];

/**
 * AUDIO SYSTEM
 */
let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        } catch (e) {
            console.warn("Web Audio API not supported");
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (isMuted || !audioCtx) return;
    initAudio(); // Ensure context is running

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'feed') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } 
    else if (type === 'splash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.3);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, t + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
        gain2.gain.setValueAtTime(0.1, t + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc2.start(t + 0.1);
        osc2.stop(t + 0.25);
    }
}

/**
 * CLASSES
 */
class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.markedForDeletion = false;
    }
}

class Food extends Entity {
    constructor(x, y) {
        super(x, y);
        this.size = 3;
        this.vy = 1 + Math.random();
        this.vx = (Math.random() - 0.5) * 0.5;
        this.color = '#8B4513';
    }

    update(height) {
        this.y += this.vy;
        this.x += this.vx;
        if (this.y > height - 30) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Bubble extends Entity {
    constructor(x, y) {
        super(x, y);
        this.size = Math.random() * 3 + 1;
        this.speed = Math.random() * 1 + 0.5;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update() {
        this.y -= this.speed;
        this.wobble += 0.05;
        this.x += Math.sin(this.wobble) * 0.5;
        if (this.y < -10) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

class Fish extends Entity {
    constructor(canvasWidth, canvasHeight, typeConfig) {
        super(Math.random() * canvasWidth, Math.random() * (canvasHeight - 100) + 50);
        this.config = typeConfig;
        
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.angle = Math.random() * Math.PI * 2;
        
        this.baseSpeed = typeConfig.speed;
        this.currentSpeed = this.baseSpeed;
        this.size = typeConfig.size;
        
        this.tailAngle = 0;
        this.finAngle = 0;
        this.state = 'IDLE';
        this.target = null;
    }

    update(width, height, foods) {
        this.target = null;
        let minDist = Infinity;

        // Find Food
        for (const food of foods) {
            const dx = food.x - this.x;
            const dy = food.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 200 && dist < minDist) {
                minDist = dist;
                this.target = food;
            }
        }

        let targetAngle = this.angle;
        
        if (this.target) {
            this.state = 'CHASING';
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            targetAngle = Math.atan2(dy, dx);
            this.currentSpeed = this.baseSpeed * 1.5;

            if (minDist < 10) {
                this.target.markedForDeletion = true;
                this.state = 'IDLE';
            }
        } else {
            this.state = 'IDLE';
            this.currentSpeed = this.baseSpeed;
            
            // Wall Avoidance
            const margin = 50;
            let avoidX = 0;
            let avoidY = 0;
            
            if (this.x < margin) avoidX = 1;
            if (this.x > width - margin) avoidX = -1;
            if (this.y < margin) avoidY = 1;
            if (this.y > height - margin - 30) avoidY = -1;

            if (avoidX !== 0 || avoidY !== 0) {
                targetAngle = Math.atan2(avoidY || Math.sin(this.angle), avoidX || Math.cos(this.angle));
            } else if (Math.random() < 0.01) {
                targetAngle = this.angle + (Math.random() - 0.5) * 2;
            }
        }

        // Smooth rotation
        let diff = targetAngle - this.angle;
        while (diff <= -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.angle += diff * this.config.turnSpeed;

        // Move
        this.vx = Math.cos(this.angle) * this.currentSpeed;
        this.vy = Math.sin(this.angle) * this.currentSpeed;
        this.x += this.vx;
        this.y += this.vy;

        // Animate
        this.tailAngle += 0.2 * (this.currentSpeed / 2);
        this.finAngle += 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const facingLeft = Math.abs(this.angle) > Math.PI / 2;
        if (facingLeft) {
            ctx.scale(1, -1);
            ctx.rotate(this.angle + Math.PI);
        } else {
            ctx.rotate(this.angle);
        }

        // Body
        ctx.fillStyle = this.config.color;
        ctx.beginPath();
        if (this.config.tall) {
            ctx.ellipse(0, 0, this.size, this.size * 1.2, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        // Tail
        ctx.fillStyle = this.config.finColor;
        ctx.beginPath();
        const tailWiggle = Math.sin(this.tailAngle) * 5;
        ctx.moveTo(-this.size, 0);
        ctx.lineTo(-this.size - 10, -5 + tailWiggle);
        ctx.lineTo(-this.size - 10, 5 + tailWiggle);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.beginPath();
        if (this.config.tall) {
            ctx.moveTo(0, -this.size/2);
            ctx.lineTo(-5, -this.size * 1.8);
            ctx.lineTo(5, -this.size/2);
            ctx.moveTo(0, this.size/2);
            ctx.lineTo(-5, this.size * 1.8);
            ctx.lineTo(5, this.size/2);
        } else {
            ctx.moveTo(0, 0);
            ctx.lineTo(-5, -8);
            ctx.lineTo(5, 0);
        }
        ctx.fill();

        // Eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.size * 0.5, -this.size * 0.2, this.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.size * 0.5 + 1, -this.size * 0.2, this.size * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * MAIN APPLICATION
 */
const canvas = document.getElementById('aquarium');
const ctx = canvas.getContext('2d');
const uiFishCount = document.getElementById('fish-count');
const uiFoodCount = document.getElementById('food-count');

let isDay = true;
let fish = [];
let foods = [];
let bubbles = [];
let plants = [];
let width = window.innerWidth;
let height = window.innerHeight;

// --- Initialization ---

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function initPlants() {
    plants = [];
    for (let i = 0; i < 10; i++) {
        plants.push({
            x: Math.random() * width,
            height: 100 + Math.random() * 150,
            color: `rgb(0, ${100 + Math.random() * 100}, 0)`,
            offset: Math.random() * Math.PI * 2
        });
    }
}

function addFish(typeConfig, silent = false) {
    initAudio(); // Initialize audio context on first interaction usually
    fish.push(new Fish(width, height, typeConfig));
    updateUI();
    if (!silent) playSound('splash');
}

function updateUI() {
    uiFishCount.innerText = fish.length;
    uiFoodCount.innerText = foods.length;
}

// --- Setup Buttons ---

// Generate Fish Buttons
const fishBtnContainer = document.getElementById('fish-buttons');
FISH_TYPES.forEach(type => {
    const btn = document.createElement('button');
    btn.className = "fish-btn flex flex-col items-center justify-center w-16 h-16 bg-white/5 rounded-lg";
    btn.innerHTML = `
        <div class="w-4 h-4 rounded-full mb-1 shadow-sm" style="background-color: ${type.color}; border: 2px solid ${type.finColor}"></div>
        <span class="text-[10px] text-white font-medium">${type.name.split(' ')[0]}</span>
    `;
    btn.onclick = (e) => {
        e.stopPropagation(); // Prevent dropping food when clicking button
        addFish(type);
    };
    fishBtnContainer.appendChild(btn);
});

// Day/Night Toggle
const btnDayNight = document.getElementById('btn-daynight');
btnDayNight.onclick = (e) => {
    e.stopPropagation();
    isDay = !isDay;
    if (isDay) {
        btnDayNight.className = "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors bg-amber-400 text-amber-900 hover:bg-amber-300";
        document.getElementById('icon-day').classList.remove('hidden');
        document.getElementById('icon-night').classList.add('hidden');
    } else {
        btnDayNight.className = "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors bg-slate-700 text-slate-100 hover:bg-slate-600";
        document.getElementById('icon-day').classList.add('hidden');
        document.getElementById('icon-night').classList.remove('hidden');
    }
};

// Mute Toggle
const btnMute = document.getElementById('btn-mute');
btnMute.onclick = (e) => {
    e.stopPropagation();
    isMuted = !isMuted;
    if (isMuted) {
        btnMute.className = "p-2 rounded-lg transition-colors border border-white/10 bg-red-500/20 text-red-200";
        document.getElementById('icon-vol-on').classList.add('hidden');
        document.getElementById('icon-vol-off').classList.remove('hidden');
    } else {
        btnMute.className = "p-2 rounded-lg transition-colors border border-white/10 bg-white/10 text-white hover:bg-white/20";
        document.getElementById('icon-vol-on').classList.remove('hidden');
        document.getElementById('icon-vol-off').classList.add('hidden');
    }
    // Resume context if it was suspended
    initAudio();
};

// Reset
document.getElementById('btn-reset').onclick = (e) => {
    e.stopPropagation();
    fish = [];
    foods = [];
    updateUI();
};

// Canvas Interaction (Feed)
canvas.onclick = (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    foods.push(new Food(x, y));
    playSound('feed');
    updateUI();
};

// --- Game Loop ---
let time = 0;

function animate() {
    time += 0.02;
    const colors = isDay ? TANK_COLORS.day : TANK_COLORS.night;

    // 1. Clear & Background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colors.top);
    gradient.addColorStop(1, colors.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Sand
    ctx.fillStyle = colors.sand;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height - 60);
    for (let i = 0; i <= width; i += 20) {
        ctx.lineTo(i, height - 60 + Math.sin(i * 0.01) * 10);
    }
    ctx.lineTo(width, height);
    ctx.fill();

    // 3. Plants
    plants.forEach(plant => {
        ctx.strokeStyle = plant.color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(plant.x, height - 50);
        const sway = Math.sin(time + plant.offset) * 20;
        ctx.quadraticCurveTo(plant.x + sway/2, height - 50 - plant.height/2, plant.x + sway, height - 50 - plant.height);
        ctx.stroke();
    });

    // 4. Foods
    foods = foods.filter(f => !f.markedForDeletion);
    foods.forEach(food => {
        food.update(height);
        food.draw(ctx);
    });

    // 5. Fish
    fish.forEach(f => {
        f.update(width, height, foods);
        f.draw(ctx);
    });

    // 6. Bubbles
    if (Math.random() < 0.05) {
        bubbles.push(new Bubble(Math.random() * width, height));
    }
    bubbles = bubbles.filter(b => !b.markedForDeletion);
    bubbles.forEach(b => {
        b.update();
        b.draw(ctx);
    });

    // Clean UI if massive changes (optimization)
    if (foods.length === 0 && uiFoodCount.innerText !== "0") updateUI();

    requestAnimationFrame(animate);
}

// --- Start ---
window.addEventListener('resize', resize);
resize();
initPlants();

// Add initial fish
addFish(FISH_TYPES[0], true);
addFish(FISH_TYPES[1], true);

animate();