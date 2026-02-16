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
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.type = LEAF_TYPES[Math.floor(Math.random() * LEAF_TYPES.length)];
        this.opacity = 0;
        this.collected = false;
        this.collectTimer = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, hgx, hgy, cw, ch) {
        this.wobble += dt * 1.5;
        if (this.opacity < 1 && !this.collected) this.opacity = Math.min(1, this.opacity + dt * 2);
        
        this.vx += hgx * 800 * dt;
        this.vy += hgy * 800 * dt + 5 * dt; // Slight gravity
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotationSpeed * dt + this.vx * 0.01;

        if (this.x < 20) { this.x = 20; this.vx *= -0.5; }
        if (this.x > cw - 20) { this.x = cw - 20; this.vx *= -0.5; }

        if (this.collected) {
            this.collectTimer += dt;
            this.opacity = Math.max(0, 1 - this.collectTimer * 3);
        }
    }

    collect() { this.collected = true; }
    isDead() { return this.collected && this.collectTimer > 0.5; }

    draw(ctx, time) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const s = this.type.size * 14 * (1 - (this.collectTimer || 0));
        const w = 1 + Math.sin(this.wobble) * 0.05;
        ctx.scale(w, 1/w);

        const grad = ctx.createLinearGradient(-s, -s, s, s);
        grad.addColorStop(0, this.type.color1);
        grad.addColorStop(1, this.type.color2);
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        if (this.type.shape === 'maple') {
            for(let i=0; i<5; i++) {
                const a = (i/5)*Math.PI*2 - Math.PI/2;
                ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s);
                ctx.lineTo(Math.cos(a+0.6)*s*0.4, Math.sin(a+0.6)*s*0.4);
            }
        } else {
            ctx.ellipse(0, 0, s*0.6, s, 0, 0, Math.PI*2);
        }
        ctx.fill();
        ctx.restore();
    }
}