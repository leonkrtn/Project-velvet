import { Document, Font } from '@react-pdf/renderer'

// In @react-pdf/renderer v4, the default hyphenation function is loaded lazily
// and can be null when the patterns chunk isn't ready, causing
// "TypeError: re is not a function" during text layout. A no-op callback
// short-circuits that path and lets text render without hyphenation.
Font.registerHyphenationCallback(word => [word])
import PdfCoverPage from './PdfCoverPage'
import PdfSectionAllgemein from './sections/PdfSectionAllgemein'
import PdfSectionGaesteliste from './sections/PdfSectionGaesteliste'
import PdfSectionSitzplan from './sections/PdfSectionSitzplan'
import PdfSectionAblaufplan from './sections/PdfSectionAblaufplan'
import PdfSectionCatering from './sections/PdfSectionCatering'
import PdfSectionGetraenke from './sections/PdfSectionGetraenke'
import PdfSectionBudget from './sections/PdfSectionBudget'
import PdfSectionMusik from './sections/PdfSectionMusik'
import PdfSectionMedien from './sections/PdfSectionMedien'
import PdfSectionDienstleister from './sections/PdfSectionDienstleister'
import type { PdfEventData, PdfMode, PdfSection } from './PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sections: PdfSection[]
  // When true, the Budget section is included even in extern mode (couples).
  allowBudget?: boolean
}

function buildExportTimestamp() {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(now.getDate())}.${p(now.getMonth() + 1)}.${String(now.getFullYear()).slice(2)}, ${p(now.getHours())}:${p(now.getMinutes())}`
}

export default function ForevrPdfDocument({ data, mode, sections, allowBudget }: Props) {
  const has = (s: PdfSection) => sections.includes(s)
  const showBudget = mode === 'intern' || allowBudget === true

  const headerTitle = `${data.event.title} – Forevr`
  const exportTimestamp = buildExportTimestamp()

  // Pre-compute 1-based section index for each included section
  const orderedSections: PdfSection[] = [
    'allgemein', 'gaesteliste', 'sitzplan', 'ablaufplan', 'catering',
    'getraenke', 'budget', 'musik', 'medien', 'dienstleister',
  ]
  const idxMap: Partial<Record<PdfSection, number>> = {}
  let n = 0
  for (const s of orderedSections) {
    if (sections.includes(s) && (s !== 'budget' || showBudget)) {
      n++
      idxMap[s] = n
    }
  }

  const sharedProps = { headerTitle, exportTimestamp }

  return (
    <Document
      title={data.event.title}
      author="Forevr"
      subject={`${mode === 'intern' ? 'Interne' : 'Externe'} Exportdokumentation`}
      creator="Forevr Event Management"
    >
      <PdfCoverPage data={data} mode={mode} />

      {has('allgemein') && (
        <PdfSectionAllgemein data={data} mode={mode} sectionIndex={idxMap.allgemein!} {...sharedProps} />
      )}
      {has('gaesteliste') && (
        <PdfSectionGaesteliste data={data} mode={mode} sectionIndex={idxMap.gaesteliste!} {...sharedProps} />
      )}
      {has('sitzplan') && (
        <PdfSectionSitzplan data={data} mode={mode} sectionIndex={idxMap.sitzplan!} {...sharedProps} />
      )}
      {has('ablaufplan') && (
        <PdfSectionAblaufplan data={data} mode={mode} sectionIndex={idxMap.ablaufplan!} {...sharedProps} />
      )}
      {has('catering') && (
        <PdfSectionCatering data={data} mode={mode} sectionIndex={idxMap.catering!} {...sharedProps} />
      )}
      {has('getraenke') && (
        <PdfSectionGetraenke data={data} mode={mode} sectionIndex={idxMap.getraenke!} {...sharedProps} />
      )}
      {has('budget') && showBudget && (
        <PdfSectionBudget data={data} mode={mode} sectionIndex={idxMap.budget!} {...sharedProps} />
      )}
      {has('musik') && (
        <PdfSectionMusik data={data} sectionIndex={idxMap.musik!} {...sharedProps} />
      )}
      {has('medien') && (
        <PdfSectionMedien data={data} sectionIndex={idxMap.medien!} {...sharedProps} />
      )}
      {has('dienstleister') && (
        <PdfSectionDienstleister data={data} mode={mode} sectionIndex={idxMap.dienstleister!} {...sharedProps} />
      )}
    </Document>
  )
}
