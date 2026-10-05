'use client';

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from './AppHeader';
import Toast, { type ToastState } from './Toast';
import { authHeaders, responseMessage, TOKEN_KEY, type Post } from '@/lib/client';

type SearchMode = 'all' | 'keyword' | 'user';

export default function CollectionView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [keyword, setKeyword] = useState('');
  const [searchError, setSearchError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [zoomed, setZoomed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const images = useMemo(() => posts.filter((post) => post.type === 'image'), [posts]);
  const videos = useMemo(() => posts.filter((post) => post.type === 'video'), [posts]);
  const currentImage = lightboxIndex >= 0 ? images[lightboxIndex] : null;

  const fetchPosts = async (mode: SearchMode, value = '') => {
    setLoading(true);
    try {
      const query = mode === 'user'
        ? `?user=${encodeURIComponent(value)}`
        : mode === 'keyword'
          ? `?keywords=${encodeURIComponent(value)}`
          : '';
      const response = await fetch(`/api/posts${query}`, { headers: authHeaders() });
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error(await responseMessage(response, 'Fetch posts failed!'));
      setPosts(await response.json() as Post[]);
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Fetch posts failed!' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      window.location.replace('/login');
      return;
    }
    const timer = window.setTimeout(() => void fetchPosts('all'), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!playing || lightboxIndex < 0 || images.length < 2) return;
    const timer = window.setInterval(() => {
      setLightboxIndex((index) => (index + 1) % images.length);
      setZoomed(false);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [playing, lightboxIndex, images.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex < 0) return;
      if (event.key === 'Escape') setLightboxIndex(-1);
      if (event.key === 'ArrowRight') setLightboxIndex((index) => (index + 1) % images.length);
      if (event.key === 'ArrowLeft') setLightboxIndex((index) => (index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, images.length]);

  const changeSearchMode = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchError('');
    if (mode === 'all') {
      setKeyword('');
      void fetchPosts('all');
    }
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (searchMode !== 'all' && !keyword.trim()) {
      setSearchError('Please input your search keyword!');
      return;
    }
    setSearchError('');
    void fetchPosts(searchMode, keyword.trim());
  };

  const chooseFile = (candidate?: File | null) => {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/') && !candidate.type.startsWith('video/')) {
      setToast({ kind: 'error', message: 'Please select an image or video.' });
      return;
    }
    setFile(candidate);
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const createPost = async () => {
    if (!message.trim() || !file) {
      setToast({ kind: 'error', message: !message.trim() ? 'Please input your message!' : 'Please select an image/video!' });
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('message', message.trim());
      data.append('media_file', file);
      const response = await fetch('/api/posts', { method: 'POST', headers: authHeaders(), body: data });
      if (!response.ok) throw new Error(await responseMessage(response, 'Failed to upload image/video!'));
      const post = await response.json() as Post;
      setPosts((items) => [post, ...items]);
      setActiveTab(post.type);
      setMessage('');
      setFile(null);
      setUploadOpen(false);
      setToast({ kind: 'success', message: 'The image/video is uploaded!' });
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to upload image/video!' });
    } finally {
      setUploading(false);
    }
  };

  const deletePost = async (post: Post) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await responseMessage(response, 'Delete posts failed!'));
      setPosts((items) => items.filter((item) => item.id !== post.id));
      setLightboxIndex(-1);
      setToast({ kind: 'success', message: 'Post deleted.' });
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Delete posts failed!' });
    }
  };

  const previous = () => {
    setLightboxIndex((index) => (index - 1 + images.length) % images.length);
    setZoomed(false);
  };
  const next = () => {
    setLightboxIndex((index) => (index + 1) % images.length);
    setZoomed(false);
  };

  return (
    <main className="collection-page">
      <AppHeader active="collection" />
      <section className="collection-header">
        <div>
          <p className="eyebrow dark-eyebrow">Your visual archive</p>
          <h1>Collection</h1>
          <p>Search the moments and ideas shared across Social AI.</p>
        </div>

        <form className="search-panel" onSubmit={search}>
          <div className="search-input-row">
            <label className="sr-only" htmlFor="collection-search">Search posts</label>
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              id="collection-search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              disabled={searchMode === 'all'}
              placeholder={searchMode === 'user' ? 'Search by username' : 'Search messages'}
            />
            <button type="submit" disabled={searchMode === 'all'}>Search</button>
          </div>
          <p className="search-error" aria-live="polite">{searchError}</p>
          <fieldset className="search-modes">
            <legend className="sr-only">Search type</legend>
            {(['all', 'keyword', 'user'] as SearchMode[]).map((mode) => (
              <label key={mode}>
                <input type="radio" name="search-mode" checked={searchMode === mode} onChange={() => changeSearchMode(mode)} />
                <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
              </label>
            ))}
          </fieldset>
        </form>
      </section>

      <section className="collection-content">
        <div className="collection-tabs-row">
          <div className="collection-tabs" role="tablist" aria-label="Media type">
            <button type="button" role="tab" aria-selected={activeTab === 'image'} className={activeTab === 'image' ? 'active' : ''} onClick={() => setActiveTab('image')}>
              Images <span>{images.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'video'} className={activeTab === 'video' ? 'active' : ''} onClick={() => setActiveTab('video')}>
              Videos <span>{videos.length}</span>
            </button>
          </div>
          <button className="primary-button create-post-button" type="button" onClick={() => setUploadOpen(true)}>
            <span aria-hidden="true">＋</span> Create New Post
          </button>
        </div>

        {loading ? (
          <div className="gallery-loading" role="status">
            {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state"><span aria-hidden="true">◇</span><h2>No data!</h2><p>Create your first post to start the collection.</p><button className="secondary-button" type="button" onClick={() => setUploadOpen(true)}>Create New Post</button></div>
        ) : activeTab === 'image' ? (
          images.length === 0 ? <div className="empty-state"><span aria-hidden="true">□</span><h2>No images!</h2><p>Upload an image or generate one in the studio.</p><a className="secondary-button" href="/create">Open Create</a></div> :
          <div className="photo-grid">
            {images.map((post, index) => (
              <article className="photo-card" key={post.id}>
                <button type="button" className="photo-open" onClick={() => setLightboxIndex(index)} aria-label={`Open ${post.message}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.url} alt={post.message} loading="lazy" />
                </button>
                <div className="photo-overlay">
                  <div><strong>@{post.user}</strong><p>{post.message}</p></div>
                  <button type="button" onClick={() => void deletePost(post)} aria-label={`Delete ${post.message}`}>⌫</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          videos.length === 0 ? <div className="empty-state"><span aria-hidden="true">▷</span><h2>No videos!</h2><p>Upload a video to see it here.</p><button className="secondary-button" type="button" onClick={() => setUploadOpen(true)}>Upload video</button></div> :
          <div className="video-list">
            {videos.map((post) => (
              <article className="video-card" key={post.id}>
                <video src={post.url} controls preload="metadata" />
                <div><div><strong>@{post.user}</strong><p>{post.message}</p></div><button type="button" onClick={() => void deletePost(post)}>Delete</button></div>
              </article>
            ))}
          </div>
        )}
      </section>

      {uploadOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setUploadOpen(false)}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <header><div><span>New media</span><h2 id="upload-title">Create New Post</h2></div><button type="button" onClick={() => setUploadOpen(false)} aria-label="Close">×</button></header>
            <div className="upload-form">
              <label><span>Message</span><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Tell the story behind this post…" /></label>
              <label><span>Image or video</span></label>
              <button
                type="button"
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={drop}
              >
                <span className="upload-symbol" aria-hidden="true">⇧</span>
                <strong>{file ? file.name : 'Click or drag file to this area to upload'}</strong>
                <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type}` : 'Images and videos up to 25 MB'}</small>
              </button>
              <input ref={fileRef} className="sr-only" type="file" accept="image/*,video/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
            </div>
            <footer><button className="tertiary-button" type="button" onClick={() => setUploadOpen(false)}>Cancel</button><button className="primary-button" type="button" onClick={() => void createPost()} disabled={uploading}>{uploading ? 'Uploading…' : 'Create'}</button></footer>
          </section>
        </div>
      )}

      {currentImage && (
        <div className="lightbox gallery-lightbox" ref={lightboxRef} role="dialog" aria-modal="true" aria-label="Photo gallery">
          <div className="lightbox-toolbar">
            <span className="lightbox-count">{lightboxIndex + 1} / {images.length}</span>
            <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause slideshow' : 'Start slideshow'}>{playing ? 'Ⅱ' : '▶'}<span>{playing ? 'Pause' : 'Play'}</span></button>
            <button type="button" onClick={() => setZoomed((value) => !value)} aria-label="Toggle zoom">⌕<span>Zoom</span></button>
            <button type="button" onClick={() => lightboxRef.current?.requestFullscreen()} aria-label="View fullscreen">⛶<span>Fullscreen</span></button>
            <button type="button" onClick={() => void deletePost(currentImage)} aria-label="Delete image">⌫<span>Delete</span></button>
            <button type="button" onClick={() => setLightboxIndex(-1)} aria-label="Close gallery">×</button>
          </div>
          {images.length > 1 && <button className="lightbox-arrow lightbox-previous" type="button" onClick={previous} aria-label="Previous image">‹</button>}
          <div className={`lightbox-media ${zoomed ? 'zoomed' : ''}`} onClick={() => setZoomed((value) => !value)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lightbox-image" src={currentImage.url} alt={currentImage.message} />
          </div>
          {images.length > 1 && <button className="lightbox-arrow lightbox-next" type="button" onClick={next} aria-label="Next image">›</button>}
          <div className="lightbox-caption"><strong>@{currentImage.user}</strong><span>{currentImage.message}</span></div>
          <div className="lightbox-thumbnails" aria-label="Image thumbnails">
            {images.map((post, index) => (
              <button key={post.id} type="button" className={index === lightboxIndex ? 'active' : ''} onClick={() => { setLightboxIndex(index); setZoomed(false); }} aria-label={`View image ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
