import { WaterSimulation } from './WaterSimulation.js';
import { Leaf } from '../entities/Leaf.js';
import { Particle } from '../entities/Particle.js';
import { CONFIG } from './Config.js';

export class Game {
    constructor(waterCanvas, overlayCanvas, onStateChange) {
        this.waterCanvas = waterCanvas;
        this.overlayCanvas = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d');
        this.onStateChange = onStateChange;

        this.waterSim = new WaterSimulation(waterCanvas, CONFIG.WATER_GRID_SIZE);
        
        this.leaves = [];
        this.particles = [];
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.leafSpawnTimer = 0;
        this.leafSpawnInterval = CONFIG.LEAF_SPAWN_INTERVAL_BASE;
        this.heightReadTimer = 0;
        this.heightField = null;

        this.sun = { x: 0.3, y: 0.3, z: CONFIG.SUN_Z, screenX: 60, screenY: 60, dragging: false };
        this.mouse = { down: false, lastX: 0, lastY: 0 };
        
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.loadSounds();

        this.resize();
        this.bindEvents();
        
        // Initial setup
        for(let i=0; i<3; i++) this.spawnLeaf();
        this.addAmbientRipple();
    }

    async loadSounds() {
        const load = async (name) => {
            const res = await fetch(`${name}.mp3`);
            const arrayBuffer = await res.arrayBuffer();
            this.sounds[name] = await this.audioCtx.decodeAudioData(arrayBuffer);
        };
        try {
            await Promise.all([load('collect'), load('splash')]);
        } catch(e) { console.warn("Audio failed to load", e); }
    }

    playSound(name, volume = 0.5) {
        if (!this.sounds[name]) return;
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.sounds[name];
        const gain = this.audioCtx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.audioCtx.destination);
        source.start(0);
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        [this.waterCanvas, this.overlayCanvas].forEach(c => {
            c.width = this.width * dpr;
            c.height = this.height * dpr;
            c.style.width = this.width + 'px';
            c.style.height = this.height + 'px';
        });

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.collectionZoneHeight = Math.max(CONFIG.COLLECTION_ZONE_MIN, this.height * CONFIG.COLLECTION_ZONE_RATIO);
    }

    bindEvents() {
        const getPos = (e) => {
            const rect = this.overlayCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const onStart = (e) => {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const pos = getPos(e);
            const dx = pos.x - this.sun.screenX;
            const dy = pos.y - this.sun.screenY;
            if (dx * dx + dy * dy < 1200) {
                this.sun.dragging = true;
                return;
            }
            this.mouse.down = true;
            this.mouse.lastX = pos.x;
            this.mouse.lastY = pos.y;
            this.addRipple(pos.x, pos.y, 0, 0, 0.15);
        };

        const onMove = (e) => {
            const pos = getPos(e);
            if (this.sun.dragging) {
                this.sun.screenX = pos.x;
                this.sun.screenY = pos.y;
                this.updateSunDirection();
                return;
            }
            if (this.mouse.down) {
                const dx = pos.x - this.mouse.lastX;
                const dy = pos.y - this.mouse.lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 3) {
                    this.addRipple(pos.x, pos.y, dx / dist, dy / dist, Math.min(0.35, dist * 0.006));
                    this.mouse.lastX = pos.x;
                    this.mouse.lastY = pos.y;
                }
            }
        };

        const onEnd = () => {
            this.mouse.down = false;
            this.sun.dragging = false;
        };

        this.overlayCanvas.addEventListener('mousedown', onStart);
        this.overlayCanvas.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        this.overlayCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e); }, { passive: false });
        this.overlayCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('resize', () => this.resize());
    }

    updateSunDirection() {
        const cx = this.width / 2;
        const cy = this.height / 2;
        // Increase range from [-0.5, 0.5] to roughly [-1.2, 1.2] for more dramatic angles
        this.sun.x = (this.sun.screenX - cx) / (this.width * 0.4);
        this.sun.y = -(this.sun.screenY - cy) / (this.height * 0.4);
        // Lower Z makes the light more horizontal/directional
        this.sun.z = 0.4;
        const len = Math.sqrt(this.sun.x**2 + this.sun.y**2 + this.sun.z**2);
        this.sun.x /= len; this.sun.y /= len; this.sun.z /= len;
    }

    addRipple(x, y, dx, dy, strength) {
        this.waterSim.addDisturbance({
            x: x / this.width,
            y: 1.0 - y / this.height,
            radius: 0.03,
            strength,
            dirX: dx * 0.5,
            dirY: -dy * 0.5
        });
    }

    addAmbientRipple() {
        this.waterSim.addDisturbance({
            x: 0.1 + Math.random() * 0.8,
            y: 0.1 + Math.random() * 0.8,
            radius: 0.02 + Math.random() * 0.02,
            strength: 0.01 + Math.random() * 0.02,
            dirX: 0, dirY: 0
        });
    }

    spawnLeaf() {
        const leaf = new Leaf(30 + Math.random() * (this.width - 60), -20 - Math.random() * 30);
        this.leaves.push(leaf);
        setTimeout(() => {
            this.addRipple(leaf.x, Math.max(10, leaf.y), 0, 0, 0.04);
            this.playSound('splash', 0.1);
        }, 400);
    }

    collectLeaf(leaf) {
        leaf.collect();
        this.score += 10 * (1 + this.combo);
        this.combo++;
        this.comboTimer = CONFIG.COMBO_TIMEOUT;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(leaf.x, leaf.y, leaf.type.color1));
        }
        this.playSound('collect', 0.3);
        this.emitState();
    }

    emitState() {
        if (this.onStateChange) {
            this.onStateChange({
                score: this.score,
                combo: this.combo,
                leafCount: this.leaves.filter(l => !l.collected).length
            });
        }
    }

    getHeightGradientAt(x, y) {
        if (!this.heightField) return { dx: 0, dy: 0 };
        const grid = this.waterSim.getGridSize();
        const gx = Math.floor((x / this.width) * grid.width);
        const gy = Math.floor((1.0 - y / this.height) * grid.height);
        if (gx < 1 || gx >= grid.width - 1 || gy < 1 || gy >= grid.height - 1) return { dx: 0, dy: 0 };
        
        const hf = this.heightField;
        const idx = (r, c) => (r * grid.width + c) * 4;
        // central differences on the red channel (height)
        const rawGradX = (hf[idx(gy, gx + 1)] - hf[idx(gy, gx - 1)]) * 0.5;
        const rawGradY = (hf[idx(gy + 1, gx)] - hf[idx(gy - 1, gx)]) * 0.5;
        // amplify gradients so leaves feel the waves and flip Y to match screen coordinates
        const scale = -100;
        return { dx: rawGradX * scale, dy: -rawGradY * scale };
    }

    update(dt) {
        const subSteps = 3;
        for (let i = 0; i < subSteps; i++) this.waterSim.step(dt / subSteps);

        this.heightReadTimer += dt;
        if (this.heightReadTimer > 0.05) {
            this.heightReadTimer = 0;
            this.heightField = this.waterSim.readHeightField();
        }

        this.leaves.forEach(leaf => {
            const grad = this.getHeightGradientAt(leaf.x, leaf.y);
            leaf.update(dt, grad.dx, grad.dy, this.width, this.height);
            if (leaf.y > this.height - this.collectionZoneHeight && !leaf.collected) {
                this.collectLeaf(leaf);
            }
        });
        this.leaves = this.leaves.filter(l => !l.isDead());

        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.emitState(); }
        }

        this.leafSpawnTimer += dt;
        if (this.leafSpawnTimer >= this.leafSpawnInterval) {
            this.leafSpawnTimer = 0;
            this.leafSpawnInterval = CONFIG.LEAF_SPAWN_INTERVAL_BASE + Math.random() * CONFIG.LEAF_SPAWN_INTERVAL_VAR;
            this.spawnLeaf();
            this.emitState();
        }

        if (Math.random() < 0.01) this.addAmbientRipple();

        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);
    }

    render() {
        this.waterSim.render(this.sun.x, this.sun.y, this.sun.z);
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawCollectionZone();
        const time = this.waterSim.getTime();
        // Sort leaves by Y to maintain consistent rendering depth
        this.leaves.sort((a,b) => a.y - b.y).forEach(l => l.draw(this.ctx, time, this.sun));
        this.particles.forEach(p => p.draw(this.ctx));
        this.drawSun();
    }

    drawCollectionZone() {
        const y = this.height - this.collectionZoneHeight;
        const time = this.waterSim.getTime();
        const ctx = this.ctx;
        
        ctx.save();
        const grad = ctx.createLinearGradient(0, y - 15, 0, y + 15);
        grad.addColorStop(0, 'rgba(255, 215, 100, 0)');
        grad.addColorStop(0.5, `rgba(255, 230, 150, ${0.2 + 0.1 * Math.sin(time * 2)})`);
        grad.addColorStop(1, 'rgba(255, 215, 100, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 15, this.width, 30);

        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -time * 20;
        ctx.strokeStyle = `rgba(255, 230, 150, 0.3)`;
        ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(this.width - 20, y); ctx.stroke();
        
        ctx.font = '10px system-ui';
        ctx.fillStyle = `rgba(255, 230, 180, 0.3)`;
        ctx.textAlign = 'center';
        ctx.fillText('▽  C O L L E C T  ▽', this.width / 2, y + this.collectionZoneHeight / 2 + 4);
        ctx.restore();
    }

    drawSun() {
        const { screenX: x, screenY: y } = this.sun;
        const time = this.waterSim.getTime();
        const ctx = this.ctx;
        ctx.save();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 25);
        glow.addColorStop(0, 'rgba(255, 240, 180, 0.4)');
        glow.addColorStop(1, 'rgba(255, 200, 50, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    start() {
        const loop = () => {
            const now = performance.now();
            const dt = Math.min(0.05, (now - (this.lastTime || now)) / 1000);
            this.lastTime = now;
            this.update(dt);
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.updateSunDirection();
        loop();
    }

    destroy() {
        cancelAnimationFrame(this.animId);
        this.waterSim.destroy();
    }
}