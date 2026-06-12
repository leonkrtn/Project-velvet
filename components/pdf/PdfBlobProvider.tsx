// All @react-pdf/renderer code lives in this single dynamic-import chunk.
//
// Two separate dynamic() imports for BlobProvider and ForevrPdfDocument created
// two separate webpack chunks, each with their own copy of @react-pdf/renderer's
// module state (including the internal `re` function). With split chunks, one
// copy of `re` is always null, causing "TypeError: re is not a function" on every
// text layout pass regardless of Font.registerHyphenationCallback calls.
//
// Importing BlobProvider, Font, AND ForevrPdfDocument (which transitively pulls
// in all section components) in one module ensures a single @react-pdf/renderer
// instance — one `re`, set up correctly before any rendering.
import { useMemo, type ReactNode } from 'react'
import { BlobProvider, Font } from '@react-pdf/renderer'
import ForevrPdfDocument from './ForevrPdfDocument'
import type { PdfEventData, PdfMode, PdfSection } from './PdfTypes'

Font.registerHyphenationCallback((word: string) => [word])

interface Props {
  data: PdfEventData
  mode: PdfMode
  sections: PdfSection[]
  children: (props: { url: string | null; loading: boolean; error: Error | null }) => ReactNode
}

export default function PdfBlobProviderWithDoc({ data, mode, sections, children }: Props) {
  const doc = useMemo(
    () => <ForevrPdfDocument data={data} mode={mode} sections={sections} />,
    [data, mode, sections],
  )
  return (
    <BlobProvider document={doc}>
      {children}
    </BlobProvider>
  )
}
