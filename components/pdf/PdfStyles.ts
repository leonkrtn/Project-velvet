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
}

export const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#2D2D2D',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
  },
  pageLandscape: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#2D2D2D',
    backgroundColor: '#FFFFFF',
    paddingTop: 36,
    paddingBottom: 50,
    paddingLeft: 36,
    paddingRight: 36,
  },

  /* Section header */
  sectionHeader: {
    backgroundColor: '#0F0F0F',
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.2,
  },

  /* Sub headers */
  subHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F0F0F',
    marginBottom: 6,
    marginTop: 12,
  },

  /* Stat boxes row */
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderStyle: 'solid',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0F0F0F',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Key-value grids */
  kvGrid2: {
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
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
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
    backgroundColor: '#F5F5F5',
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 9,
    color: '#2D2D2D',
    lineHeight: 1.35,
  },
  tableCellHeader: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableCellMuted: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 9,
    color: '#6B6B6B',
    fontStyle: 'italic',
  },

  /* Utility */
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6B6B6B' },
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
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  /* Page footer */
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#6B6B6B',
  },
})
