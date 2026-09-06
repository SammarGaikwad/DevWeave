import { useEffect, useRef } from 'react';

const VIDEO_URL = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4";

export const BackgroundVideo = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fadingOutRef = useRef<boolean>(false);
  const opacityRef = useRef<number>(0);
  const fadeStartTimeRef = useRef<number | null>(null);
  const startOpacityRef = useRef<number>(0);
  const targetOpacityRef = useRef<number>(1);

  // Core rAF opacity animation helper
  const animateOpacityTo = (target: number) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    startOpacityRef.current = opacityRef.current;
    targetOpacityRef.current = target;
    fadeStartTimeRef.current = performance.now();

    const FADE_DURATION = 500; // 500ms

    const step = (now: number) => {
      const startTime = fadeStartTimeRef.current ?? now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / FADE_DURATION);

      // Smooth linear or ease interpolation from current opacity
      const nextOpacity = startOpacityRef.current + (targetOpacityRef.current - startOpacityRef.current) * progress;
      opacityRef.current = nextOpacity;

      if (videoRef.current) {
        videoRef.current.style.opacity = nextOpacity.toFixed(4);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Initial opacity state
    video.style.opacity = '0';
    opacityRef.current = 0;

    // Initial load fade to 1
    const handleCanPlay = () => {
      if (!fadingOutRef.current && opacityRef.current === 0) {
        animateOpacityTo(1);
      }
    };

    const handleTimeUpdate = () => {
      if (!video.duration) return;

      const timeRemaining = video.duration - video.currentTime;

      // Trigger fade out when 0.55 seconds remaining
      if (timeRemaining <= 0.55 && !fadingOutRef.current) {
        fadingOutRef.current = true;
        animateOpacityTo(0);
      }
    };

    const handleEnded = () => {
      fadingOutRef.current = true;
      if (videoRef.current) {
        videoRef.current.style.opacity = '0';
      }
      opacityRef.current = 0;

      // Wait 100ms, then reset currentTime = 0, play(), and fade back to 1
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = 0;
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              fadingOutRef.current = false;
              animateOpacityTo(1);
            })
            .catch((err) => {
              console.warn("Autoplay replay interrupted:", err);
              fadingOutRef.current = false;
            });
        } else {
          fadingOutRef.current = false;
          animateOpacityTo(1);
        }
      }, 100);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    // Initial play trigger
    const initialPlay = video.play();
    if (initialPlay !== undefined) {
      initialPlay
        .then(() => {
          animateOpacityTo(1);
        })
        .catch(() => {
          // Fallback if autoplay policy blocks initial play
        });
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black z-0 pointer-events-none">
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%] overflow-hidden bg-black min-h-screen opacity-0 transition-none"
      />
      {/* Cinematic subtle dark gradient overlays for extra depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-[1]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/40 to-black pointer-events-none z-[1]" />
    </div>
  );
};
