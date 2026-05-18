// Registers the hyphenation callback in the same module-init as BlobProvider.
//
// Why this file exists:
// @react-pdf/renderer v4 loads its text-layout chunk (and captures the internal
// hyphenation variable `re`) the moment BlobProvider's dynamic-import chunk
// initialises. If Font.registerHyphenationCallback is called later — e.g. from
// VelvetPdfDocument.tsx, a separate dynamic import — `re` is already bound to null
// and every Text layout pass crashes with "re is not a function".
//
// Exporting BlobProvider from a thin wrapper that *also* calls
// Font.registerHyphenationCallback ensures the callback is set in the same
// synchronous module-init that triggers @react-pdf/renderer to load, before any
// text layout can run.
import { BlobProvider, Font } from '@react-pdf/renderer'

Font.registerHyphenationCallback(word => [word])

export { BlobProvider }
