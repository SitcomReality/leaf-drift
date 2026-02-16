export class UIController {
    constructor() {
        this.scoreEl = document.getElementById('score');
        this.comboEl = document.getElementById('combo');
        this.leafCountEl = document.getElementById('leaf-count');
        this.helpEl = document.getElementById('help-overlay');
        
        setTimeout(() => {
            if (this.helpEl) this.helpEl.classList.add('opacity-0');
        }, 6000);
    }

    update(state) {
        if (this.scoreEl) this.scoreEl.innerText = state.score;
        
        if (this.comboEl) {
            if (state.combo > 1) {
                this.comboEl.innerText = `×${state.combo} combo`;
                this.comboEl.classList.remove('opacity-0');
            } else {
                this.comboEl.classList.add('opacity-0');
            }
        }

        if (this.leafCountEl) {
            this.leafCountEl.innerText = `${state.leafCount} ${state.leafCount === 1 ? 'leaf' : 'leaves'} on water`;
        }
    }
}