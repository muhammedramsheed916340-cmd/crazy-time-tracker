"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { CRAZY_TIME_LIVE_STREAM_URL } from "@/lib/crazytime/constants";

type Status = "loading" | "live" | "reconnecting" | "error";

// Loads hls.js dynamically so it never crashes the page if the CDN is unavailable.
export function LiveVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    try {
      const hls = hlsRef.current;
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startStream = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    cleanup();
    attemptRef.current += 1;
    setAttempt(attemptRef.current);
    setStatus(attemptRef.current === 1 ? "loading" : "reconnecting");

    try {
      // Dynamically import hls.js and prefer it whenever it is supported.
      // Native HLS (Safari/iOS) only handles single-variant playlists well;
      // the Crazy Time master playlist has multiple variants and Chromium's
      // native HLS demuxer fails on it, so we use hls.js whenever possible.
      let Hls: any = null;
      try {
        const HlsModule = await import("hls.js");
        Hls = HlsModule.default;
      } catch {
        Hls = null;
      }

      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          liveDurationInfinity: true,
          liveBackBufferLength: 0,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1500,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 1500,
          fragLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 1500,
          xhrSetup: (xhr: XMLHttpRequest) => {
            // Some CDNs require a Referer to serve the playlist.
            try {
              xhr.withCredentials = false;
            } catch {
              /* ignore */
            }
          },
        });
        hlsRef.current = hls;
        hls.loadSource(CRAZY_TIME_LIVE_STREAM_URL);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            /* autoplay may be blocked */
          });
          setStatus("live");
        });
        hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
          if (!data) return;
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                try {
                  hls.startLoad();
                } catch {
                  scheduleReconnect();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                try {
                  hls.recoverMediaError();
                } catch {
                  scheduleReconnect();
                }
                break;
              default:
                scheduleReconnect();
                break;
            }
          }
        });
        return;
      }

      // Fallback: native HLS (Safari / iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = CRAZY_TIME_LIVE_STREAM_URL;
        await video.play().catch(() => {
          /* autoplay may be blocked */
        });
        setStatus("live");
        return;
      }

      setStatus("error");
    } catch {
      scheduleReconnect();
    }
  }, [cleanup]);

  const scheduleReconnect = useCallback(() => {
    setStatus("reconnecting");
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    // Exponential backoff capped at 15s
    const delay = Math.min(15000, 1500 * Math.pow(1.7, attemptRef.current));
    reconnectTimerRef.current = setTimeout(() => {
      startStream();
    }, delay);
  }, [startStream]);

  // Manual retry
  const retryNow = useCallback(() => {
    attemptRef.current = 0;
    startStream();
  }, [startStream]);

  useEffect(() => {
    startStream();
    return () => {
      cleanup();
    };
  }, [startStream, cleanup]);

  // Native HLS video error handler
  const onVideoError = useCallback(() => {
    scheduleReconnect();
  }, [scheduleReconnect]);

  const onVideoPlaying = useCallback(() => setStatus("live"), []);

  const statusBadge = (() => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
          </Badge>
        );
      case "loading":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600">
            <RotateCcw className="w-3 h-3 animate-spin" /> Reconnecting (#{attempt})
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" /> Stream offline
          </Badge>
        );
    }
  })();

  return (
    <Card className="overflow-hidden border-0 bg-black rounded-none sm:rounded-lg">
      <CardContent className="p-0">
        <div className="relative w-full aspect-video bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            controls={false}
            onError={onVideoError}
            onPlaying={onVideoPlaying}
          />
          {/* Top overlay bar */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-white text-sm font-semibold">Crazy Time Live</span>
            </div>
            <div className="pointer-events-auto">{statusBadge}</div>
          </div>
          {/* Error / reconnect overlay */}
          {(status === "error" || status === "reconnecting") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-white/90 text-sm text-center px-4 max-w-md">
                {status === "error"
                  ? "Live stream temporarily unavailable. We will keep retrying."
                  : `Reconnecting to the live stream (attempt #${attempt})…`}
              </p>
              <Button size="sm" variant="secondary" onClick={retryNow} className="gap-1">
                <RotateCcw className="w-3 h-3" /> Retry now
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
