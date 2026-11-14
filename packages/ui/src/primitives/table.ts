import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

// Table is a pure presentational primitive. `Table` is the container
// (`table`); sub-builders are attached as properties: Table.header, Table.body,
// Table.footer, Table.row, Table.head, Table.cell, Table.caption.

export const tableContainerClass = css({
  position: 'relative',
  width: '100%',
  overflowX: 'auto',
})

export const tableClass = css({
  width: '100%',
  captionSide: 'bottom',
  fontSize: 'type.14',
  lineHeight: 'fine',
})

export const tableHeaderClass = css({
  '& tr': {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
  },
})

export const tableBodyClass = css({
  '& tr:last-child': {
    borderWidth: '0',
  },
})

export const tableFooterClass = css({
  backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  fontWeight: 'medium',
  '&>tr': {
    '&:last-child': {
      borderBottomWidth: '0px',
    },
  },
})

export const tableRowClass = css({
  _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
  '&[data-state="selected"]': { backgroundColor: 'muted' },
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  '&:has([aria-expanded])': {
    backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
  },
})

export const tableHeadClass = css({
  color: 'foreground',
  height: '10',
  paddingInline: '2',
  textAlign: 'left',
  verticalAlign: 'middle',
  fontWeight: 'medium',
  whiteSpace: 'nowrap',
  '&:has([role=checkbox])': {
    paddingRight: '0',
  },
})

export const tableCellClass = css({
  padding: '2',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  '&:has([role=checkbox])': {
    paddingRight: '0',
  },
})

export const tableCaptionClass = css({
  color: 'mutedForeground',
  marginTop: '4',
  fontSize: 'type.14',
  lineHeight: 'fine',
})

type StyleConfig = Readonly<{ className?: string }>

const tableContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(tableContainerClass)), h.DataAttribute('slot', 'table-container')],
    [
      h.table(
        [h.Class(cx(tableClass, config.className)), h.DataAttribute('slot', 'table')],
        children,
      ),
    ],
  )

const tableHeader = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.thead(
    [h.Class(cx(tableHeaderClass, config.className)), h.DataAttribute('slot', 'table-header')],
    children,
  )

const tableBody = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tbody(
    [h.Class(cx(tableBodyClass, config.className)), h.DataAttribute('slot', 'table-body')],
    children,
  )

const tableFooter = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tfoot(
    [h.Class(cx(tableFooterClass, config.className)), h.DataAttribute('slot', 'table-footer')],
    children,
  )

const tableRow = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tr(
    [h.Class(cx(tableRowClass, config.className)), h.DataAttribute('slot', 'table-row')],
    children,
  )

const tableHead = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.th(
    [h.Class(cx(tableHeadClass, config.className)), h.DataAttribute('slot', 'table-head')],
    children,
  )

const tableCell = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.td(
    [h.Class(cx(tableCellClass, config.className)), h.DataAttribute('slot', 'table-cell')],
    children,
  )

const tableCaption = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.caption(
    [h.Class(cx(tableCaptionClass, config.className)), h.DataAttribute('slot', 'table-caption')],
    children,
  )

/** Composable table — `Table` is the container, with sub-builders as
 *  properties: `Table.header`, `Table.body`, `Table.footer`, `Table.row`,
 *  `Table.head`, `Table.cell`, `Table.caption`. */
export const Table = Object.assign(tableContainer, {
  header: tableHeader,
  body: tableBody,
  footer: tableFooter,
  row: tableRow,
  head: tableHead,
  cell: tableCell,
  caption: tableCaption,
})
