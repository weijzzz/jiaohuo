import { useCallback, useEffect, useRef, useState } from 'react'
import { createScanner, type BarcodeScanner, type ScanEngine } from './detector'

export type ScannerState = 'idle' | 'starting' | 'running' | 'error'

interface Options {
  /**
   * Called once per accepted read. The same barcode is not reported again
   * until `cooldownMs` has passed, so holding the camera on one product does
   * not fire continuously.
   */
  onScan: (value: string) => void
  cooldownMs?: number
  /**
   * How many consecutive frames must agree before a read is accepted. Two
   * costs a few milliseconds and removes most misreads on a blurry frame.
   */
  confirmations?: number
  /**
   * Keep the camera open but stop reading frames, e.g. while the article
   * sheet is on top of the viewfinder.
   */
  paused?: boolean
}

interface TorchControl {
  supported: boolean
  on: boolean
  toggle: () => Promise<void>
}

/** Frame pacing. ZXing decodes in JS and cannot keep up with the native rate. */
const INTERVAL: Record<ScanEngine, number> = { native: 80, zxing: 160 }

/**
 * Camera lifecycle for the scanner screen.
 *
 * The camera is released whenever scanning stops or the component unmounts —
 * leaving a track live keeps the phone's camera indicator on and drains the
 * battery of a device that is meant to last a shift.
 */
export function useScanner({
  onScan,
  cooldownMs = 2000,
  confirmations = 2,
  paused = false,
}: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<BarcodeScanner | null>(null)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ value: string; count: number } | null>(null)
  const lastAcceptedRef = useRef<{ value: string; at: number } | null>(null)
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  /**
   * Bumped by every start() and stop(). An await inside start() that
   * resolves after the session changed (tab switched while the permission
   * prompt was open, component unmounted...) must not keep the camera.
   */
  const sessionRef = useRef(0)
  const resumeOnVisibleRef = useRef(false)

  const [state, setState] = useState<ScannerState>('idle')
  const [engine, setEngine] = useState<ScanEngine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({
    supported: false,
    on: false,
  })

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    pausedRef.current = paused
    if (!paused) {
      // Coming back from the article sheet with the same product still in
      // front of the camera should not reopen it straight away.
      pendingRef.current = null
      if (lastAcceptedRef.current) lastAcceptedRef.current.at = Date.now()
    }
  }, [paused])

  const stop = useCallback(() => {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    scannerRef.current?.dispose()
    scannerRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) videoRef.current.srcObject = null
    pendingRef.current = null
    setTorch({ supported: false, on: false })
    setState('idle')
  }, [])

  const accept = useCallback(
    (value: string) => {
      const now = Date.now()
      const last = lastAcceptedRef.current
      if (last && last.value === value && now - last.at < cooldownMs) return

      const pending = pendingRef.current
      if (pending?.value === value) {
        pending.count += 1
      } else {
        pendingRef.current = { value, count: 1 }
      }
      if ((pendingRef.current?.count ?? 0) < confirmations) return

      pendingRef.current = null
      lastAcceptedRef.current = { value, at: now }
      onScanRef.current(value)
    },
    [confirmations, cooldownMs],
  )

  const start = useCallback(async () => {
    if (state === 'starting' || state === 'running') return
    const session = ++sessionRef.current
    const isStale = () => session !== sessionRef.current
    setState('starting')
    setError(null)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Este navegador no permite usar la cámara. Prueba con Chrome o Safari, y comprueba que la página esté en HTTPS.',
        )
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      if (isStale()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const video = videoRef.current
      if (!video) throw new Error('No se ha podido iniciar el vídeo.')
      video.srcObject = stream
      // iOS refuses to play an inline video that is not muted.
      video.muted = true
      video.setAttribute('playsinline', 'true')
      await video.play()
      if (isStale()) return // stop() already released the stream

      const track = stream.getVideoTracks()[0]
      const capabilities = track?.getCapabilities?.()
      setTorch({ supported: Boolean(capabilities?.torch), on: false })

      const scanner = await createScanner()
      if (isStale()) {
        scanner.dispose()
        return
      }
      scannerRef.current = scanner
      setEngine(scanner.engine)
      setState('running')

      const tick = async () => {
        const current = scannerRef.current
        const element = videoRef.current
        if (!current || !element) return
        try {
          if (!pausedRef.current) {
            for (const value of await current.detect(element)) accept(value)
          }
        } catch {
          // Keep the loop alive; a single bad frame is not worth stopping for.
        }
        if (scannerRef.current) {
          timerRef.current = window.setTimeout(tick, INTERVAL[current.engine])
        }
      }
      void tick()
    } catch (cause) {
      // play() rejects with AbortError when stop() clears the video mid-start;
      // that is a cancellation, not something to show the user.
      if (isStale()) return
      const message =
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo en los ajustes del navegador.'
          : cause instanceof DOMException && cause.name === 'NotFoundError'
            ? 'No se ha encontrado ninguna cámara en este dispositivo.'
            : cause instanceof Error
              ? cause.message
              : 'No se ha podido iniciar la cámara.'
      stop()
      setError(message)
      setState('error')
    }
  }, [accept, state, stop])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch.on
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorch((previous) => ({ ...previous, on: next }))
    } catch {
      setTorch((previous) => ({ ...previous, supported: false }))
    }
  }, [torch.on])

  useEffect(() => stop, [stop])

  // Release the camera while the app is in the background (switching to
  // WhatsApp, locking the phone) and reopen it on return.
  const startRef = useRef(start)
  useEffect(() => {
    startRef.current = start
  }, [start])
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        resumeOnVisibleRef.current =
          stateRef.current === 'running' || stateRef.current === 'starting'
        if (resumeOnVisibleRef.current) stop()
      } else if (resumeOnVisibleRef.current) {
        resumeOnVisibleRef.current = false
        void startRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stop])

  const torchControl: TorchControl = { ...torch, toggle: toggleTorch }
  return { videoRef, state, engine, error, torch: torchControl, start, stop }
}
