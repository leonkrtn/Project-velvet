import { Document } from '@react-pdf/renderer'
import PdfCoverPage from './PdfCoverPage'
import PdfSectionAllgemein from './sections/PdfSectionAllgemein'
import PdfSectionGaesteliste from './sections/PdfSectionGaesteliste'
import PdfSectionSitzplan from './sections/PdfSectionSitzplan'
import PdfSectionAblaufplan from './sections/PdfSectionAblaufplan'
import PdfSectionCatering from './sections/PdfSectionCatering'
import PdfSectionBudget from './sections/PdfSectionBudget'
import PdfSectionMusik from './sections/PdfSectionMusik'
import PdfSectionDekoration from './sections/PdfSectionDekoration'
import PdfSectionPatisserie from './sections/PdfSectionPatisserie'
import PdfSectionMedien from './sections/PdfSectionMedien'
import PdfSectionDienstleister from './sections/PdfSectionDienstleister'
import type { PdfEventData, PdfMode, PdfSection } from './PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sections: PdfSection[]
}

export default function VelvetPdfDocument({ data, mode, sections }: Props) {
  const has = (s: PdfSection) => sections.includes(s)

  return (
    <Document
      title={data.event.title}
      author="Velvet"
      subject={`${mode === 'intern' ? 'Interne' : 'Externe'} Exportdokumentation`}
      creator="Velvet Event Management"
    >
      <PdfCoverPage data={data} mode={mode} />

      {has('allgemein')     && <PdfSectionAllgemein     data={data} mode={mode} />}
      {has('gaesteliste')   && <PdfSectionGaesteliste   data={data} mode={mode} />}
      {has('sitzplan')      && <PdfSectionSitzplan      data={data} mode={mode} />}
      {has('ablaufplan')    && <PdfSectionAblaufplan     data={data} mode={mode} />}
      {has('catering')      && <PdfSectionCatering      data={data} mode={mode} />}
      {has('budget') && mode === 'intern' && <PdfSectionBudget data={data} mode={mode} />}
      {has('musik')         && <PdfSectionMusik         data={data} />}
      {has('dekoration')    && <PdfSectionDekoration    data={data} mode={mode} />}
      {has('patisserie')    && <PdfSectionPatisserie    data={data} mode={mode} />}
      {has('medien')        && <PdfSectionMedien        data={data} />}
      {has('dienstleister') && <PdfSectionDienstleister data={data} mode={mode} />}
    </Document>
  )
}
