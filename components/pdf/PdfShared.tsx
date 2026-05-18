import { View, Text } from '@react-pdf/renderer'

// Extracts HH:MM from an ISO timestamp or returns the value as-is for plain time strings.
export function fmtTime(value: string | null | undefined): string {
  if (!value) return '—'
  const isoMatch = value.match(/T(\d{2}:\d{2})/)
  if (isoMatch) return isoMatch[1]
  const plainMatch = value.match(/^(\d{2}:\d{2})/)
  return plainMatch ? plainMatch[1] : value
}

interface PageHeaderProps {
  title: string
  timestamp: string
}

export function PageHeader({ title, timestamp }: PageHeaderProps) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 8, color: '#9CA3AF', fontFamily: 'Helvetica' }}>{title}</Text>
      <Text style={{ fontSize: 8, color: '#9CA3AF', fontFamily: 'Helvetica' }}>{timestamp}</Text>
    </View>
  )
}

interface SectionTitleProps {
  index: number
  title: string
}

export function SectionTitle({ index, title }: SectionTitleProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 7,
          color: '#9CA3AF',
          fontFamily: 'Helvetica-Bold',
          letterSpacing: 0.8,
          marginBottom: 4,
        }}
      >
        {`ABSCHNITT ${String(index).padStart(2, '0')}`}
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontFamily: 'Helvetica-Bold',
          color: '#0F0F0F',
          lineHeight: 1.1,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <View style={{ height: 1, backgroundColor: '#0F0F0F' }} />
    </View>
  )
}

export function PageFooter() {
  return (
    <Text
      fixed
      style={{
        position: 'absolute',
        bottom: 20,
        right: 40,
        fontSize: 8,
        color: '#9CA3AF',
        fontFamily: 'Helvetica',
      }}
      render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
    />
  )
}

// Inline status badge used inside table cells
interface StatusBadgeProps {
  label: string
  bg: string
  color?: string
}

export function StatusBadge({ label, bg, color = '#FFFFFF' }: StatusBadgeProps) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 2,
        paddingVertical: 2,
        paddingHorizontal: 5,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 7,
          fontFamily: 'Helvetica-Bold',
          color,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
