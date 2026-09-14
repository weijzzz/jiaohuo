/**
 * Barcode detection, with two engines behind one interface.
 *
 * Chrome on Android has `BarcodeDetector` built in and it is far faster and
 * more accurate than anything shipped in JS. Safari on iOS does not have it at
 * all, so ZXing is loaded — but only there, and only on demand, so the phones
 * that do not need a decoder never download one.
 */

export type ScanEngine = 'native' | 'zxing'

export interface BarcodeScanner {
  engine: ScanEngine
  /** Read the current frame. Returns every barcode found, usually none. */
  detect(video: HTMLVideoElement): Promise<string[]>
  dispose(): void
}

/** Retail 1D symbologies, plus CODE_128 for shelf and internal labels. */
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'] as const

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

function nativeDetector(): BarcodeDetectorConstructor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
  return ctor ?? null
}

/**
 * Whether the native detector can actually read retail barcodes.
 *
 * Desktop Chrome on Linux exposes the constructor but supports no formats, so
 * the presence of the API is not enough to go on — the format list is.
 */
export async function nativeFormats(): Promise<string[]> {
  const ctor = nativeDetector()
  if (!ctor) return []
  try {
    const supported = await ctor.getSupportedFormats()
    return NATIVE_FORMATS.filter((format) => supported.includes(format))
  } catch {
    return []
  }
}

/**
 * A canvas holding the middle band of the frame.
 *
 * A 1D barcode only has to cross the scan line, so decoding a centre strip
 * instead of the whole frame is both faster and less likely to lock onto
 * something else on the packaging.
 */
function createFrameGrabber() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  return function grab(video: HTMLVideoElement): HTMLCanvasElement | null {
    const { videoWidth, videoHeight } = video
    if (!context || videoWidth === 0 || videoHeight === 0) return null

    const width = Math.min(videoWidth, 1280)
    const scale = width / videoWidth
    const bandHeight = Math.round(videoHeight * scale * 0.5)

    canvas.width = width
    canvas.height = bandHeight
    context.drawImage(
      video,
      0,
      Math.round(videoHeight * 0.25),
      videoWidth,
      Math.round(videoHeight * 0.5),
      0,
      0,
      width,
      bandHeight,
    )
    return canvas
  }
}

async function createNativeScanner(formats: string[]): Promise<BarcodeScanner> {
  const ctor = nativeDetector()!
  const detector = new ctor({ formats })
  const grab = createFrameGrabber()

  return {
    engine: 'native',
    async detect(video) {
      const canvas = grab(video)
      if (!canvas) return []
      try {
        const results = await detector.detect(canvas)
        return results.map((result) => result.rawValue).filter(Boolean)
      } catch {
        // A detector can throw on a frame that is mid-resize; the next frame
        // is a few milliseconds away, so there is nothing to recover here.
        return []
      }
    },
    dispose() {},
  }
}

async function createZxingScanner(): Promise<BarcodeScanner> {
  const zxing = await import('@zxing/library')
  const {
    BarcodeFormat,
    BinaryBitmap,
    DecodeHintType,
    HTMLCanvasElementLuminanceSource,
    HybridBinarizer,
    MultiFormatReader,
  } = zxing

  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.CODE_128,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)

  const reader = new MultiFormatReader()
  reader.setHints(hints)
  const grab = createFrameGrabber()

  return {
    engine: 'zxing',
    async detect(video) {
      const canvas = grab(video)
      if (!canvas) return []
      try {
        const source = new HTMLCanvasElementLuminanceSource(canvas)
        const bitmap = new BinaryBitmap(new HybridBinarizer(source))
        const result = reader.decode(bitmap)
        const text = result.getText()
        return text ? [text] : []
      } catch {
        // ZXing signals "nothing in this frame" by throwing NotFoundException,
        // which is the common case rather than an error.
        return []
      } finally {
        reader.reset()
      }
    },
    dispose() {
      reader.reset()
    },
  }
}

/** Pick the best available engine, preferring the browser's own decoder. */
export async function createScanner(): Promise<BarcodeScanner> {
  const formats = await nativeFormats()
  if (formats.length > 0) return createNativeScanner(formats)
  return createZxingScanner()
}
