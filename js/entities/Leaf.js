import { CONFIG } from '../core/Config.js';

const LEAF_TYPES = [
    { color1: '#c0392b', color2: '#e74c3c', shape: 'maple', size: 1.0 },
    { color1: '#d35400', color2: '#e67e22', shape: 'oak', size: 0.9 },
    { color1: '#f39c12', color2: '#f1c40f', shape: 'round', size: 0.8 },
    { color1: '#27ae60', color2: '#2ecc71', shape: 'long', size: 0.85 },
];

export class Leaf {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.va = (Math.random() - 0.5) * 0.5;
        this.type = LEAF_TYPES[Math.floor(Math.random() * LEAF_TYPES.length)];
        this.opacity = 0;
        this.collected = false;
        this.collectTimer = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, hgx, hgy, cw, ch) {
        this.wobble += dt * 1.5;
        if (this.opacity < 1 && !this.collected) this.opacity = Math.min(1, this.opacity + dt * 2);
        
        this.vx += hgx * CONFIG.LEAF_WAVE_FORCE * dt;
        this.vy += hgy * CONFIG.LEAF_WAVE_FORCE * dt + CONFIG.LEAF_GRAVITY * dt;
        this.vx *= CONFIG.LEAF_DRAG;
        this.vy *= CONFIG.LEAF_DRAG;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Improved rotational physics:
        // Horizontal velocity acts as a torque to build up angular momentum (va).
        // High damping and hard caps prevent erratic jitter and extreme spin speeds.
        const torque = this.vx * CONFIG.LEAF_TORQUE_SCALE; 
        this.va += torque * dt;
        this.va *= Math.pow(CONFIG.LEAF_ROTATIONAL_FRICTION, dt * 60);
        this.va = Math.max(-CONFIG.LEAF_MAX_SPIN, Math.min(CONFIG.LEAF_MAX_SPIN, this.va));
        this.rotation += this.va * dt;

        if (this.x < 20) { this.x = 20; this.vx *= -0.5; }
        if (this.x > cw - 20) { this.x = cw - 20; this.vx *= -0.5; }

        if (this.collected) {
            this.collectTimer += dt;
            this.opacity = Math.max(0, 1 - this.collectTimer * 3);
        }
    }

    collect() { this.collected = true; }
    isDead() { return this.collected && this.collectTimer > 0.5; }

    draw(ctx, time, sun) {
        if (this.opacity <= 0) return;
        const s = this.type.size * 14 * (1 - (this.collectTimer || 0));
        const wobbleScale = 1 + Math.sin(this.wobble) * 0.05;

        // Draw Shadow
        ctx.save();
        ctx.globalAlpha = this.opacity * 0.3;
        // Offset shadow based on sun position (sun.z is constant 0.4, so x/y are the drivers)
        // sun.x is screen right, sun.y is screen up.
        const shadowOffsetX = -sun.x * CONFIG.LEAF_SHADOW_OFFSET_SCALE;
        const shadowOffsetY = sun.y * CONFIG.LEAF_SHADOW_OFFSET_SCALE;
        ctx.translate(this.x + shadowOffsetX, this.y + shadowOffsetY);
        ctx.rotate(this.rotation);
        ctx.scale(wobbleScale, 1/wobbleScale);
        ctx.fillStyle = '#000';
        this.drawShape(ctx, s, true);
        ctx.restore();

        // Draw Leaf Body
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(wobbleScale, 1/wobbleScale);

        // Calculate simple "bump" shading based on sun angle relative to leaf rotation
        // We project the sun vector onto the leaf's local space
        const cosR = Math.cos(-this.rotation);
        const sinR = Math.sin(-this.rotation);
        const sunLocalX = sun.x * cosR - (-sun.y) * sinR;
        const sunLocalY = sun.x * sinR + (-sun.y) * cosR;
        
        // Base leaf gradient
        const grad = ctx.createLinearGradient(-s, -s, s, s);
        grad.addColorStop(0, this.type.color1);
        grad.addColorStop(1, this.type.color2);
        ctx.fillStyle = grad;
        
        this.drawShape(ctx, s);
        
        // Leaf Texture / Veins (bump map effect)
        // Make veins and micro-contrast stronger so texture reads at small sizes
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.8;
        this.drawVeins(ctx, s);

        // Add a faint inner highlight vein pass for subtle brightness along the central vein
        ctx.strokeStyle = 'rgba(255,255,220,0.12)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(0, s * 0.2);
        ctx.stroke();

        // Bump-map-like shading: Highlight/Shadow overlays based on sunLocalX/Y
        // We use globalCompositeOperation to add highlights and shadows
        const bumpIntensity = CONFIG.LEAF_BUMP_INTENSITY;
        
        // Light side (Screen)
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255, 255, 200, ${Math.max(0, Math.min(1, sunLocalX * bumpIntensity))})`;
        this.drawShape(ctx, s);
        
        // Dark side (Multiply)
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(0, 0, 28, ${Math.max(0, Math.min(1, -sunLocalX * bumpIntensity))})`;
        this.drawShape(ctx, s);

        // Subtle organic mottling overlay to make the leaf surface look textured
        ctx.globalCompositeOperation = 'overlay';
        const tex = ctx.createRadialGradient(0, -s * 0.15, s * 0.08, 0, s * 0.35, s);
        tex.addColorStop(0, `rgba(255,255,255,${0.06 + bumpIntensity * 0.12})`);
        tex.addColorStop(1, `rgba(0,0,0,${0.05})`);
        ctx.fillStyle = tex;
        this.drawShape(ctx, s);

        // Restore composite and state
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    drawShape(ctx, s, includeStem = false) {
        ctx.beginPath();
        if (this.type.shape === 'maple') {
            for(let i=0; i<5; i++) {
                const a = (i/5)*Math.PI*2 - Math.PI/2;
                ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s);
                ctx.lineTo(Math.cos(a+0.6)*s*0.4, Math.sin(a+0.6)*s*0.4);
            }
        } else if (this.type.shape === 'oak') {
            for(let i=0; i<8; i++) {
                const a = (i/8)*Math.PI*2;
                const r = s * (0.7 + 0.3 * Math.sin(i * 3));
                ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
        } else {
            ctx.ellipse(0, 0, s*0.6, s, 0, 0, Math.PI*2);
        }
        ctx.closePath();
        ctx.fill();

        // Always draw stem if requested or if it's not a shadow
        if (includeStem || ctx.globalAlpha > 0.4) {
            ctx.beginPath();
            ctx.moveTo(0, s * 0.8);
            ctx.lineTo(0, s * (0.8 + CONFIG.LEAF_STEM_LENGTH));
            ctx.lineWidth = s * 0.1;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    drawVeins(ctx, s) {
        ctx.beginPath();
        // Central vein
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        // Side veins
        for(let i=-2; i<=2; i++) {
            const y = (i/3) * s;
            ctx.moveTo(0, y);
            ctx.lineTo(s * 0.4, y - s * 0.2);
            ctx.moveTo(0, y);
            ctx.lineTo(-s * 0.4, y - s * 0.2);
        }
        ctx.stroke();
    }
}