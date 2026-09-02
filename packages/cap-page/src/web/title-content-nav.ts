export const FOCUS_RECORD_TITLE = 'biu:focus-record-title'
export const FOCUS_RECORD_CONTENT = 'biu:focus-record-content'

export function isDocStartSelection(from: number, empty: boolean, docStart: number) {
  return empty && from === docStart
}
