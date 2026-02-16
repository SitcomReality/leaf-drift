import * as Shaders from './Shaders.js';

export class WaterSimulation {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl', { alpha: false });
        if (!gl) throw new Error('WebGL not supported');
        this.gl = gl;

        gl.getExtension('OES_texture_float');
        gl.getExtension('OES_texture_float_linear');

        this.gridWidth = gridSize;
        this.gridHeight = gridSize;
        this.time = 0;
        this.currentIndex = 0;

        this.programs = {
            sim: this.createProgram(Shaders.SIM_VERT, Shaders.SIM_FRAG),
            disturb: this.createProgram(Shaders.SIM_VERT, Shaders.DISTURB_FRAG),
            render: this.createProgram(Shaders.SIM_VERT, Shaders.RENDER_FRAG)
        };

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

        this.textures = [];
        this.framebuffers = [];
        for (let i = 0; i < 3; i++) {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gridSize, gridSize, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            
            this.textures.push(tex);
            this.framebuffers.push(fb);
        }
    }

    createProgram(v, f) {
        const gl = this.gl;
        const load = (t, s) => {
            const sh = gl.createShader(t);
            gl.shaderSource(sh, s);
            gl.compileShader(sh);
            return sh;
        };
        const p = gl.createProgram();
        gl.attachShader(p, load(gl.VERTEX_SHADER, v));
        gl.attachShader(p, load(gl.FRAGMENT_SHADER, f));
        gl.linkProgram(p);
        return p;
    }

    drawQuad(p) {
        const gl = this.gl;
        const pos = gl.getAttribLocation(p, 'a_position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    addDisturbance(d) {
        const gl = this.gl;
        const p = this.programs.disturb;
        gl.useProgram(p);
        gl.viewport(0, 0, this.gridWidth, this.gridHeight);
        
        const readIdx = (this.currentIndex + 1) % 3;
        const writeIdx = (this.currentIndex + 2) % 3;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[writeIdx]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[readIdx]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_current'), 0);
        gl.uniform2f(gl.getUniformLocation(p, 'u_center'), d.x, d.y);
        gl.uniform1f(gl.getUniformLocation(p, 'u_radius'), d.radius);
        gl.uniform1f(gl.getUniformLocation(p, 'u_strength'), d.strength);
        gl.uniform2f(gl.getUniformLocation(p, 'u_direction'), d.dirX, d.dirY);
        this.drawQuad(p);

        [this.textures[readIdx], this.textures[writeIdx]] = [this.textures[writeIdx], this.textures[readIdx]];
        [this.framebuffers[readIdx], this.framebuffers[writeIdx]] = [this.framebuffers[writeIdx], this.framebuffers[readIdx]];
    }

    step(dt) {
        this.time += dt;
        const gl = this.gl;
        const p = this.programs.sim;
        gl.useProgram(p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[(this.currentIndex + 2) % 3]);
        gl.viewport(0, 0, this.gridWidth, this.gridHeight);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[(this.currentIndex + 1) % 3]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_current'), 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIndex]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_previous'), 1);
        
        gl.uniform2f(gl.getUniformLocation(p, 'u_texelSize'), 1/this.gridWidth, 1/this.gridHeight);
        gl.uniform1f(gl.getUniformLocation(p, 'u_damping'), 0.995);
        this.drawQuad(p);
        this.currentIndex = (this.currentIndex + 1) % 3;
    }

    render(sx, sy, sz) {
        const gl = this.gl;
        const p = this.programs.render;
        gl.useProgram(p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[(this.currentIndex + 1) % 3]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_heightMap'), 0);
        gl.uniform2f(gl.getUniformLocation(p, 'u_texelSize'), 1/this.gridWidth, 1/this.gridHeight);
        gl.uniform3f(gl.getUniformLocation(p, 'u_sunPos'), sx, sy, sz);
        gl.uniform1f(gl.getUniformLocation(p, 'u_time'), this.time);
        this.drawQuad(p);
    }

    readHeightField() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[(this.currentIndex + 1) % 3]);
        const pixels = new Float32Array(this.gridWidth * this.gridHeight * 4);
        gl.readPixels(0, 0, this.gridWidth, this.gridHeight, gl.RGBA, gl.FLOAT, pixels);
        return pixels;
    }

    getGridSize() { return { width: this.gridWidth, height: this.gridHeight }; }
    getTime() { return this.time; }
    destroy() {
        this.textures.forEach(t => this.gl.deleteTexture(t));
        this.framebuffers.forEach(f => this.gl.deleteFramebuffer(f));
    }
}