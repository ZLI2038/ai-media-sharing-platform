'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import AppHeader from './AppHeader';
import Toast, { type ToastState } from './Toast';
import { authHeaders, responseMessage, TOKEN_KEY } from '@/lib/client';

const suggestions = [
  'A glass observatory above violet clouds, editorial photography',
  'A paper-cut forest where every leaf glows, midnight palette',
  'Retro-futurist train crossing a quiet desert at blue hour',
];

function promptSeed(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return Math.abs(seed);
}

function demoImage(prompt: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot render the local preview.');
  const seed = promptSeed(prompt);
  const hueA = seed % 360;
  const hueB = (hueA + 115 + (seed % 70)) % 360;

  const background = context.createLinearGradient(0, 0, 1024, 1024);
  background.addColorStop(0, `hsl(${hueA} 55% 13%)`);
  background.addColorStop(0.48, '#111117');
  background.addColorStop(1, `hsl(${hueB} 62% 14%)`);
  context.fillStyle = background;
  context.fillRect(0, 0, 1024, 1024);

  for (let index = 0; index < 11; index += 1) {
    const x = (seed * (index + 3) * 31) % 1024;
    const y = (seed * (index + 7) * 17) % 1024;
    const radius = 110 + ((seed >> (index % 12)) % 250);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `hsla(${index % 2 ? hueA : hueB} 90% 66% / .28)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  context.save();
  context.translate(512, 530);
  context.rotate(((seed % 18) - 9) * Math.PI / 180);
  for (let index = -7; index <= 7; index += 1) {
    context.beginPath();
    context.ellipse(index * 56, Math.sin(index) * 18, 155, 420, index * 0.08, 0, Math.PI * 2);
    context.strokeStyle = `hsla(${(hueA + index * 12 + 360) % 360} 78% 75% / .11)`;
    context.lineWidth = 3;
    context.stroke();
  }
  context.restore();

  context.fillStyle = 'rgba(255,255,255,.06)';
  for (let index = 0; index < 52; index += 1) {
    const x = (seed * (index + 19) * 13) % 1024;
    const y = (seed * (index + 23) * 29) % 1024;
    context.fillRect(x, y, 2, 2);
  }
  return canvas.toDataURL('image/png');
}

export default function CreateStudio() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [demo, setDemo] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) window.location.replace('/login');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const generate = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 3) {
      setToast({ kind: 'error', message: 'Describe the image in a little more detail.' });
      return;
    }
    setLoading(true);
    setImage(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error(await responseMessage(response, 'Image generation failed.'));
      const result = await response.json() as { image?: string; demo?: boolean };
      const nextImage = result.image || demoImage(cleanPrompt);
      setDemo(Boolean(result.demo));
      setImage(nextImage);
      setToast({
        kind: 'success',
        message: result.demo ? 'Studio preview created. Add an API key for full AI generation.' : 'Your image is ready.',
      });
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  const upload = async () => {
    if (!image) return;
    setUploading(true);
    try {
      const blob = await (await fetch(image)).blob();
      const data = new FormData();
      data.append('message', demo ? `Studio preview: ${prompt.trim()}` : 'AI generated image');
      data.append('media_file', new File([blob], 'social-ai.png', { type: 'image/png' }));
      const response = await fetch('/api/posts', { method: 'POST', headers: authHeaders(), body: data });
      if (!response.ok) throw new Error(await responseMessage(response, 'Upload failed.'));
      setToast({ kind: 'success', message: 'Image uploaded to your collection.' });
      setLightbox(false);
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const download = () => {
    if (!image) return;
    const anchor = document.createElement('a');
    anchor.href = image;
    anchor.download = 'social-ai.png';
    anchor.click();
  };

  return (
    <main className="studio-page">
      <AppHeader active="create" />
      <section className="studio-hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="studio-copy">
          <p className="eyebrow">Imagine · Create · Share</p>
          <h1>Social AI</h1>
          <p>Unleash creativity, share memories—where AI meets your imagination.</p>

          <form className="prompt-box" onSubmit={generate}>
            <label className="sr-only" htmlFor="studio-prompt">Describe your image</label>
            <textarea
              id="studio-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Enter your description here…"
            />
            <button type="submit" aria-label="Generate image" disabled={loading}>→</button>
          </form>
          <div className="prompt-hints" aria-label="Prompt suggestions">
            {suggestions.map((suggestion, index) => (
              <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}>
                {index === 0 ? 'Editorial portrait' : index === 1 ? 'Dreamlike landscape' : 'Retro-futurist city'}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="generation-stage" role="status">
            <div className="generation-orbit"><span /><span /><span /></div>
            <p>Translating your words into an image…</p>
          </div>
        )}

        {image && !loading && (
          <section className="generated-result" aria-label="Generated image">
            <button type="button" className="result-image-button" onClick={() => setLightbox(true)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`Generated from: ${prompt}`} />
              <span>Open preview</span>
            </button>
            <div className="result-meta">
              <div>
                <span className="result-label">Latest creation</span>
                <p>{prompt}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setLightbox(true)}>View & upload</button>
            </div>
          </section>
        )}
      </section>

      {lightbox && image && (
        <div className="lightbox" ref={lightboxRef} role="dialog" aria-modal="true" aria-label="Generated image preview">
          <div className="lightbox-toolbar">
            <button type="button" onClick={upload} disabled={uploading} aria-label="Upload to collection">{uploading ? '…' : '⇧'}<span>Upload</span></button>
            <button type="button" onClick={download} aria-label="Download image">↓<span>Download</span></button>
            <button type="button" onClick={() => lightboxRef.current?.requestFullscreen()} aria-label="View fullscreen">⛶<span>Fullscreen</span></button>
            <button type="button" onClick={() => setLightbox(false)} aria-label="Close preview">×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lightbox-image" src={image} alt={`Generated from: ${prompt}`} />
          <div className="lightbox-caption"><strong>{demo ? 'Studio preview' : 'AI generated image'}</strong><span>{prompt}</span></div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
