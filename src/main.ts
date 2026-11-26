import './ui/styles.css';
import { Engine } from '@babylonjs/core';
import { Game } from './core/Game';

function showFatal(message: string): void {
  const fatal = document.getElementById('fatal');
  if (!fatal) return;
  fatal.textContent = message;
  fatal.hidden = false;
}

const canvas = document.getElementById('game');
const debugAllowed =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');

if (!(canvas instanceof HTMLCanvasElement)) {
  showFatal('Missing game canvas.');
} else if (!Engine.isSupported()) {
  showFatal('BANG! BANG! needs WebGL. Please use a recent desktop Chrome, Edge or Firefox.');
} else {
  try {
    new Game(canvas, debugAllowed);
  } catch (error) {
    console.error(error);
    showFatal('The game failed to start. See the browser console for details.');
  }
}
