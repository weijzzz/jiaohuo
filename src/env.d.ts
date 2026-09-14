/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Camera torch control is supported by Chrome on Android but is not yet in
 * the DOM typings, so the two members the scanner uses are declared here.
 */
interface MediaTrackCapabilities {
  torch?: boolean
}

interface MediaTrackConstraintSet {
  torch?: ConstrainBoolean
}
