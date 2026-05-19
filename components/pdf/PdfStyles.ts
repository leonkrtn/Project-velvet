import { StyleSheet } from '@react-pdf/renderer'

export const COLORS = {
  black:      '#0F0F0F',
  darkGray:   '#2D2D2D',
  midGray:    '#6B6B6B',
  lightGray:  '#E8E8E8',
  ultraLight: '#F5F5F5',
  white:      '#FFFFFF',
  border:     '#D0D0D0',
  green:      '#16A34A',
  red:        '#DC2626',
  amber:      '#D97706',
  blue:       '#1D4ED8',
  headerGray: '#9CA3AF',
}

export const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#2D2D2D',
    backgroundColor: '#FFFFFF',
    paddingTop: 44,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
  },

  /* Stat boxes row */
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderStyle: 'solid',
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0F0F0F',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Sub headers */
  subHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0F0F0F',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },

  /* Key-value grids — 2-col and 3-col variants */
  kvGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  kvItem: {
    width: '47%',
  },
  kvItem3: {
    width: '30%',
  },
  kvLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  kvValue: {
    fontSize: 10,
    color: '#2D2D2D',
    lineHeight: 1.4,
  },

  /* Tables */
  table: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderStyle: 'solid',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F0F0F',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#D0D0D0',
    borderTopStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#D0D0D0',
    borderTopStyle: 'solid',
    backgroundColor: '#F8F8F8',
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    color: '#2D2D2D',
    lineHeight: 1.35,
  },
  tableCellHeader: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableCellMuted: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    color: '#6B6B6B',
    fontStyle: 'italic',
  },

  /* Total row in tables */
  tableRowTotal: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#0F0F0F',
    borderTopStyle: 'solid',
    backgroundColor: '#F5F5F5',
  },

  /* Utility */
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6B6B6B' },
  mutedItalic: { color: '#6B6B6B', fontStyle: 'italic', fontSize: 9 },
  small: { fontSize: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spacer: { marginBottom: 10 },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#D0D0D0',
    borderBottomStyle: 'solid',
    marginVertical: 10,
  },

  /* Inline badge */
  badge: {
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
})
