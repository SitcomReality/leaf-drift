import { Game } from './core/Game.js';
import { UIController } from './ui/UIController.js';

window.addEventListener('DOMContentLoaded', () => {
    const waterCanvas = document.getElementById('waterCanvas');
    const overlayCanvas = document.getElementById('overlayCanvas');
    
    const ui = new UIController();
    
    const game = new Game(waterCanvas, overlayCanvas, (state) => {
        ui.update(state);
    });

    game.start();

    // Cleanup on unload
    window.addEventListener('unload', () => game.destroy());
});