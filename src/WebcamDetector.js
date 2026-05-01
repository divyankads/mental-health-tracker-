import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const EMOTION_TO_MOOD = {
  happy: { emoji: '🌟', label: 'Great', value: 'great' },
  surprised: { emoji: '🙂', label: 'Good', value: 'good' },
  neutral: { emoji: '😐', label: 'Neutral', value: 'neutral' },
  fearful: { emoji: '😕', label: 'Anxious', value: 'anxious' },
  disgusted: { emoji: '😕', label: 'Anxious', value: 'anxious' },
  angry: { emoji: '😕', label: 'Anxious', value: 'anxious' },
  sad: { emoji: '😢', label: 'Sad', value: 'sad' },
};

const EMOTION_COLORS = {
  happy: '#22c55e',
  surprised: '#84cc16',
  neutral: '#64748b',
  fearful: '#f59e0b',
  disgusted: '#f97316',
  angry: '#ef4444',
  sad: '#3b82f6',
};

export default function WebcamDetector({ onMoodDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  // Load face-api models from /public/models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
        setLoadingModels(false);
      } catch (err) {
        console.error('Error loading face-api models:', err);
        setLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  // Start webcam stream
  useEffect(() => {
    if (!modelsLoaded) return;
    let localStream = null;
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        localStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setStreamReady(true);
        }
      } catch (err) {
        console.error('Webcam error:', err);
        alert('Could not access webcam. Please allow camera permission.');
      }
    };
    startVideo();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [modelsLoaded]);

  // Run detection loop
  const startDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Guard: skip if refs are gone or video not ready
      if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) return;

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length > 0) {
          const expressions = resized[0].expressions;
          const topEmotion = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0];
          setDetectedEmotion(topEmotion[0]);
          setConfidence(Math.round(topEmotion[1] * 100));

          const box = resized[0].detection.box;
          const color = EMOTION_COLORS[topEmotion[0]] || '#22c55e';
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.fillStyle = color;
          ctx.fillRect(box.x, box.y - 28, box.width, 28);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px Outfit, sans-serif';
          ctx.fillText(`${topEmotion[0].toUpperCase()} ${Math.round(topEmotion[1] * 100)}%`, box.x + 6, box.y - 8);
        } else {
          setDetectedEmotion(null);
          setConfidence(0);
        }
      } catch (err) {
        // Silently skip detection errors (e.g. component unmounted mid-frame)
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (streamReady) startDetection();
    return () => clearInterval(intervalRef.current);
  }, [streamReady, startDetection]);

  const handleConfirm = () => {
    if (!detectedEmotion) return;
    const mood = EMOTION_TO_MOOD[detectedEmotion];
    if (mood) {
      clearInterval(intervalRef.current);
      const video = videoRef.current;
      if (video?.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
      }
      onMoodDetected(mood);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'var(--card-bg)', borderRadius: '1.5rem', padding: '2rem',
        width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        border: '1px solid var(--card-border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ margin: 0, color: 'var(--accent-base)' }}>📷 Facial Emotion Scanner</h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4d4f',
            borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
            fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
        </div>

        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
          🧠 Powered by <strong>CNN (TinyFaceDetector + FaceExpressionNet)</strong> — runs entirely in your browser, no data sent.
        </p>

        {loadingModels ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚙️</div>
            <p>Loading pretrained CNN models...</p>
            <small>First load may take a few seconds</small>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: '1rem', overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
              />
              <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
              />
              {isScanning && (
                <div style={{
                  position: 'absolute', top: '0.7rem', right: '0.7rem',
                  background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem', borderRadius: '1rem', fontWeight: 700
                }}>● LIVE</div>
              )}
            </div>

            {detectedEmotion && (
              <div style={{
                marginTop: '1rem', padding: '1rem', background: 'rgba(34,197,94,0.08)',
                border: '1px solid var(--accent-base)', borderRadius: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detected Emotion</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: EMOTION_COLORS[detectedEmotion], textTransform: 'capitalize' }}>
                    {EMOTION_TO_MOOD[detectedEmotion]?.emoji} {detectedEmotion}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Confidence</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-base)' }}>{confidence}%</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="save-btn"
                onClick={handleConfirm}
                disabled={!detectedEmotion}
                style={{ flex: 1, opacity: detectedEmotion ? 1 : 0.5 }}
              >
                ✅ Use This Mood
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--card-border)',
                  borderRadius: '0.8rem', padding: '0.8rem', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '1rem'
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
