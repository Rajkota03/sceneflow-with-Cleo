'use client'

import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import { Node as TiptapNode, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Text from '@tiptap/extension-text'
import HardBreak from '@tiptap/extension-hard-break'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import type { JSONContent } from '@tiptap/react'
import {
  SceneHeading, Action, CharacterCue,
  Parenthetical, Dialogue, Transition,
  DualDialogueKeymap, FindReplaceKeymap, SceneNavKeymap,
  ContdDetection, NoteKeymap,
} from '@/lib/tiptap'
import type { Doc, BlockType, Block, PageBreakInfo } from '@/lib/doc'
import { deriveScenes, createBlock, blockId, computePageBreaks, computePageLayout } from '@/lib/doc'
import type { ViewMode, EditorTheme, ScriptView } from './editor-toolbar'
import { FindReplaceTiptap } from './find-replace-tiptap'

// ─── Props ───

interface WritingAreaTiptapProps {
  doc: Doc
  onDocChange: (doc: Doc) => void
  viewMode: ViewMode
  scriptView: ScriptView
  theme: EditorTheme
  activeSceneId: string | null
  typewriterMode?: boolean
  watermark?: string
  showRevisions?: boolean
  themeOverride?: {
    paper: string; ink: string; inkFaint: string; desk: string
    pageShadow: string; pageBreak: string; cursor: string
  } | null
  onActiveSceneChange: (id: string) => void
  onFocusedElementInfo?: (info: { type: BlockType; blockId: string } | null) => void
  onSelectionTextChange?: (text: string) => void
  editorRef?: (editor: any) => void
}

// ─── Theme Map ───

const THEMES: Record<EditorTheme, {
  paper: string; ink: string; inkFaint: string; desk: string
  pageShadow: string; pageBreak: string; cursor: string
}> = {
  parchment: {
    paper: '#1a1810', ink: '#c8bda0', inkFaint: '#4a4535',
    desk: '#0e0d0a', pageShadow: 'rgba(0,0,0,0.3)',
    pageBreak: 'rgba(200,189,160,0.06)', cursor: '#c45c4a',
  },
  midnight: {
    paper: '#0f1224', ink: '#b8c4dd', inkFaint: '#3a4560',
    desk: '#060810', pageShadow: 'rgba(80,120,200,0.08)',
    pageBreak: 'rgba(100,130,200,0.1)', cursor: '#6888cc',
  },
  dawn: {
    paper: '#faf6ee', ink: '#1a1510', inkFaint: '#b0a890',
    desk: '#e8e0d0', pageShadow: 'rgba(0,0,0,0.08)',
    pageBreak: 'rgba(0,0,0,0.08)', cursor: '#8a7040',
  },
  classic: {
    paper: '#ffffff', ink: '#000000', inkFaint: '#aaaaaa',
    desk: '#e8e8e8', pageShadow: 'rgba(0,0,0,0.15)',
    pageBreak: 'rgba(0,0,0,0.06)', cursor: '#1a1a1a',
  },
}

// ─── Block <-> TipTap Type Mapping ───

const BLOCK_TO_NODE: Record<BlockType, string> = {
  'scene-heading': 'sceneHeading',
  'action': 'action',
  'character': 'characterCue',
  'parenthetical': 'parenthetical',
  'dialogue': 'dialogue',
  'transition': 'transition',
}

const NODE_TO_BLOCK: Record<string, BlockType> = {
  sceneHeading: 'scene-heading',
  action: 'action',
  characterCue: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
}

// ─── Text with line breaks ↔ inline content ───

function textToInlineContent(text: string): JSONContent[] {
  if (!text.includes('\n')) return [{ type: 'text', text }]
  const parts = text.split('\n')
  const result: JSONContent[] = []
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) result.push({ type: 'text', text: parts[i] })
    if (i < parts.length - 1) result.push({ type: 'hardBreak' })
  }
  return result
}

// ─── Content serialization (handles hardBreak nodes) ───

function nodeContentToString(node: JSONContent): string {
  return (node.content ?? []).map(c => {
    if (c.type === 'text') return c.text || ''
    if (c.type === 'hardBreak') return '\n'
    return ''
  }).join('')
}

// ─── Conversion: Doc -> TipTap JSON ───

function docToTiptap(doc: Doc, metaMap?: Map<string, any>): JSONContent {
  // Preserve block meta in the ref map for round-tripping
  if (metaMap) {
    for (const block of doc.blocks) {
      if (block.id && Object.keys(block.meta).length > 0) {
        metaMap.set(block.id, block.meta)
      }
    }
  }

  const content: JSONContent[] = doc.blocks.map((block) => {
    const nodeName = BLOCK_TO_NODE[block.type] || 'action'
    // Strip wrapping parens from parenthetical — CSS ::before/::after handles display
    let text = block.text
    if (block.type === 'parenthetical' && text) {
      if (text.startsWith('(')) text = text.slice(1)
      if (text.endsWith(')')) text = text.slice(0, -1)
    }
    const node: JSONContent = {
      type: nodeName,
      attrs: { id: block.id },
      content: text ? textToInlineContent(text) : [],
    }
    return node
  })

  // TipTap doc needs at least one child
  if (content.length === 0) {
    content.push({
      type: 'action',
      attrs: { id: blockId() },
      content: [],
    })
  }

  return { type: 'doc', content }
}

// ─── Conversion: TipTap JSON -> Doc ───

function tiptapToDoc(
  json: JSONContent,
  meta: { id: string; title: string; titlePage?: Doc['titlePage']; version: number },
  metaMap?: Map<string, any>,
): Doc {
  const blocks: Block[] = []

  if (json.content) {
    for (const node of json.content) {
      const blockType = NODE_TO_BLOCK[node.type || '']
      if (!blockType) continue

      let text = nodeContentToString(node)
      const id = node.attrs?.id || blockId()

      // Re-wrap parenthetical text with () for the data model.
      // Strip any stray parens first — CSS handles display, so users
      // might type ( or ) which we need to clean before wrapping.
      if (blockType === 'parenthetical' && text) {
        let clean = text
        if (clean.startsWith('(')) clean = clean.slice(1)
        if (clean.endsWith(')')) clean = clean.slice(0, -1)
        text = clean ? `(${clean})` : ''
      }

      blocks.push({
        id,
        type: blockType,
        text,
        meta: metaMap?.get(id) ?? {},
      })
    }
  }

  return {
    id: meta.id,
    title: meta.title,
    titlePage: meta.titlePage,
    blocks,
    cursor: {
      position: { blockId: blocks[0]?.id ?? '', offset: 0 },
      selection: null,
    },
    version: meta.version + 1,
  }
}

// ─── Deep compare TipTap JSON content (ignoring marks/attrs we don't care about) ───

function contentEquals(a: JSONContent, b: JSONContent): boolean {
  const aNodes = a.content ?? []
  const bNodes = b.content ?? []
  if (aNodes.length !== bNodes.length) return false
  for (let i = 0; i < aNodes.length; i++) {
    const an = aNodes[i]
    const bn = bNodes[i]
    if (an.type !== bn.type) return false
    if (an.attrs?.id !== bn.attrs?.id) return false
    const aText = nodeContentToString(an)
    const bText = nodeContentToString(bn)
    if (aText !== bText) return false
  }
  return true
}

// ─── Custom top-level doc node ───

const ScreenplayDoc = TiptapNode.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
})

// ─── Page Break Decorations Extension ───
// Injects widget decorations at page boundaries so the editor
// visually separates content into US Letter pages with gaps.

const pageBreakPluginKey = new PluginKey('pageBreakDecorations')

interface PageBreakStorage {
  pageLayout: PageBreakInfo[]
  themeColors: {
    desk: string; paper: string; inkFaint: string; pageBreak: string; font: string
  }
}

// Line estimation for page break calculation (matches layout.ts)
const LINES_PER_PAGE = 55
const DIAL_CPL = 35
const ACT_CPL = 60

function estimateNodeLines(typeName: string, textLen: number): number {
  switch (typeName) {
    case 'characterCue': return 2
    case 'dialogue': return Math.max(1, Math.ceil(textLen / DIAL_CPL))
    case 'parenthetical': return 1
    case 'sceneHeading': return 3
    case 'transition': return 2
    case 'action': return 1 + Math.max(1, Math.ceil(textLen / ACT_CPL))
    default: return 1
  }
}

function computeDecorationsFromDoc(
  doc: import('@tiptap/pm/model').Node,
  font: string,
): DecorationSet {
  const decorations: Decoration[] = []
  let lineCount = 0
  let page = 1
  let activeCharacter: string | null = null

  doc.forEach((node, offset) => {
    const typeName = node.type.name
    const textLen = node.textContent.length

    // Track speaking character for CONT'D
    if (typeName === 'characterCue') {
      activeCharacter = node.textContent.trim().replace(/\s*\(.*\)$/, '').toUpperCase()
    } else if (typeName !== 'dialogue' && typeName !== 'parenthetical') {
      activeCharacter = null
    }

    const lines = estimateNodeLines(typeName, textLen)
    lineCount += lines

    if (lineCount > LINES_PER_PAGE) {
      page++
      lineCount = lines

      const contdChar = activeCharacter && (typeName === 'dialogue' || typeName === 'parenthetical')
        ? activeCharacter : undefined

      const widget = document.createElement('div')
      widget.className = 'sf-page-break-widget'
      widget.setAttribute('contenteditable', 'false')

      if (contdChar) {
        const moreEl = document.createElement('div')
        moreEl.className = 'sf-page-more'
        moreEl.textContent = '(MORE)'
        moreEl.style.fontFamily = font
        widget.appendChild(moreEl)
      }

      const gap = document.createElement('div')
      gap.className = 'sf-page-gap'
      const prevLabel = document.createElement('span')
      prevLabel.className = 'sf-page-gap-prev'
      gap.appendChild(prevLabel)
      const nextLabel = document.createElement('span')
      nextLabel.className = 'sf-page-gap-next'
      nextLabel.textContent = `${page}.`
      nextLabel.style.fontFamily = font
      gap.appendChild(nextLabel)
      widget.appendChild(gap)

      if (contdChar) {
        const contdEl = document.createElement('div')
        contdEl.className = 'sf-page-contd'
        contdEl.textContent = `${contdChar} (CONT'D)`
        contdEl.style.fontFamily = font
        widget.appendChild(contdEl)
      }

      decorations.push(
        Decoration.widget(offset, widget, {
          side: -1,
          key: `pb-${page}`,
        })
      )
    }
  })

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

const PageBreakDecorations = Extension.create<{}, PageBreakStorage>({
  name: 'pageBreakDecorations',

  addStorage() {
    return {
      pageLayout: [] as PageBreakInfo[],
      themeColors: {
        desk: '#13120f', paper: '#17160f', inkFaint: '#4a4535',
        pageBreak: 'rgba(200,189,160,0.06)', font: 'Courier',
      },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage as PageBreakStorage

    return [
      new Plugin({
        key: pageBreakPluginKey,
        state: {
          init(_, state) {
            return computeDecorationsFromDoc(state.doc, storage.themeColors.font)
          },
          apply(tr, oldDecos, _oldState, newState) {
            if (tr.docChanged || tr.getMeta(pageBreakPluginKey)?.updated) {
              return computeDecorationsFromDoc(newState.doc, storage.themeColors.font)
            }
            return oldDecos
          },
        },
        props: {
          decorations(state) {
            return pageBreakPluginKey.getState(state) as DecorationSet
          },
        },
      }),
    ]
  },
})

// ─── Scene Lock Filter Extension ───
// Prevents editing blocks that have meta.locked = true.
// Reads the metaMapRef to check lock status.

function createSceneLockFilter(metaMapRef: React.RefObject<Map<string, any>>) {
  return Extension.create({
    name: 'sceneLockFilter',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('sceneLockFilter'),
          filterTransaction(tr, state) {
            // Allow non-docChanged transactions (selection, meta-only)
            if (!tr.docChanged) return true
            const metaMap = metaMapRef.current
            if (!metaMap) return true

            // Check each step — if it touches a locked block, reject the whole transaction
            let dominated = false
            tr.steps.forEach((step, i) => {
              if (dominated) return
              const stepMap = step.getMap()
              stepMap.forEach((oldStart: number, oldEnd: number) => {
                if (dominated) return
                // Walk through all top-level nodes the step range overlaps
                state.doc.nodesBetween(oldStart, Math.min(oldEnd, state.doc.content.size), (node, pos) => {
                  if (dominated) return false
                  // Only check top-level screenplay blocks (depth 0)
                  if (node.isBlock && node.attrs?.id) {
                    const meta = metaMap.get(node.attrs.id)
                    if (meta?.locked) {
                      dominated = true
                      return false
                    }
                  }
                })
              })
            })

            return !dominated
          },
        }),
      ]
    },
  })
}

// ─── Constants ───

const PAGE_WIDTH_PX = 816
// US Letter: 8.5 x 11 inches at 96 DPI = 816 x 1056 px
// Industry margins: 1.5" left, 1" right, 1" top, 1" bottom
const PAGE_PADDING_TOP = 96     // 1 inch top margin
const PAGE_PADDING_BOTTOM = 96  // 1 inch bottom margin
const PAGE_PADDING_LEFT = 144   // 1.5 inch left margin (industry standard)
const PAGE_PADDING_RIGHT = 96   // 1 inch right margin
// Content area: 816 - 144 - 96 = 576px = 6 inches (correct)
const SCREENPLAY_FONT = 'var(--font-screenplay), "Courier New", Courier, monospace'
const FONT_SIZE = '15px'
const LINE_HEIGHT = '19.5px'

// (Legacy PageBreakMarkers overlay removed — page breaks are now handled by
// ProseMirror widget decorations via the PageBreakDecorations extension above)

// ─── Component ───

export function WritingAreaTiptap({
  doc: docProp,
  onDocChange,
  viewMode,
  scriptView,
  theme,
  activeSceneId,
  typewriterMode,
  watermark,
  showRevisions,
  themeOverride,
  onActiveSceneChange,
  onFocusedElementInfo,
  onSelectionTextChange,
  editorRef,
}: WritingAreaTiptapProps) {
  const [showFind, setShowFind] = useState(false)

  // ─── Note Annotation State ───
  const [noteBlockId, setNoteBlockId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteCoords, setNoteCoords] = useState<{ top: number; left: number } | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── Character Autocomplete State ───
  const [acSuggestions, setAcSuggestions] = useState<string[]>([])
  const [acIndex, setAcIndex] = useState(0)
  const [acCoords, setAcCoords] = useState<{ top: number; left: number } | null>(null)
  const acActiveRef = useRef(false)
  const acSuggestionsRef = useRef<string[]>([])
  const acIndexRef = useRef(0)

  // Wrappers to keep refs in sync with state (avoids stale closures in handleKeyDown)
  const updateAcSuggestions = useCallback((s: string[]) => {
    acSuggestionsRef.current = s
    setAcSuggestions(s)
    acActiveRef.current = s.length > 0
  }, [])
  const updateAcIndex = useCallback((i: number | ((prev: number) => number)) => {
    if (typeof i === 'function') {
      setAcIndex(prev => { const next = i(prev); acIndexRef.current = next; return next })
    } else {
      acIndexRef.current = i
      setAcIndex(i)
    }
  }, [])

  // ─── Scene Heading Autocomplete State ───
  const SH_TIME_SUFFIXES = ['- DAY', '- NIGHT', '- CONTINUOUS', '- LATER', '- MORNING', '- EVENING', '- DAWN', '- DUSK']
  const [shSuggestions, setShSuggestions] = useState<string[]>([])
  const [shIndex, setShIndex] = useState(0)
  const [shCoords, setShCoords] = useState<{ top: number; left: number } | null>(null)
  const [shMode, setShMode] = useState<'location' | 'time'>('location')
  const shActiveRef = useRef(false)
  const shSuggestionsRef = useRef<string[]>([])
  const shIndexRef = useRef(0)
  const shModeRef = useRef<'location' | 'time'>('location')

  const updateShSuggestions = useCallback((s: string[], mode: 'location' | 'time' = 'location') => {
    shSuggestionsRef.current = s
    setShSuggestions(s)
    shActiveRef.current = s.length > 0
    shModeRef.current = mode
    setShMode(mode)
  }, [])
  const updateShIndex = useCallback((i: number | ((prev: number) => number)) => {
    if (typeof i === 'function') {
      setShIndex(prev => { const next = i(prev); shIndexRef.current = next; return next })
    } else {
      shIndexRef.current = i
      setShIndex(i)
    }
  }, [])

  // ─── Character Extension Dropdown State (V.O., O.S., etc.) ───
  const EXT_OPTIONS = ['V.O.', 'O.S.', 'O.C.', "CONT'D"]
  const [extSuggestions, setExtSuggestions] = useState<string[]>([])
  const [extIndex, setExtIndex] = useState(0)
  const [extCoords, setExtCoords] = useState<{ top: number; left: number } | null>(null)
  const extActiveRef = useRef(false)
  const extSuggestionsRef = useRef<string[]>([])
  const extIndexRef = useRef(0)

  const updateExtSuggestions = useCallback((s: string[]) => {
    extSuggestionsRef.current = s
    setExtSuggestions(s)
    extActiveRef.current = s.length > 0
  }, [])
  const updateExtIndex = useCallback((i: number | ((prev: number) => number)) => {
    if (typeof i === 'function') {
      setExtIndex(prev => { const next = i(prev); extIndexRef.current = next; return next })
    } else {
      extIndexRef.current = i
      setExtIndex(i)
    }
  }, [])

  const settingContentRef = useRef(false)
  const metaMapRef = useRef<Map<string, any>>(new Map())
  const lastDocVersionRef = useRef(docProp.version)
  const lastActiveSceneFromCursorRef = useRef<string | null>(null)
  const docMetaRef = useRef({
    id: docProp.id,
    title: docProp.title,
    titlePage: docProp.titlePage,
    version: docProp.version,
  })

  // Keep meta ref in sync
  useEffect(() => {
    docMetaRef.current = {
      id: docProp.id,
      title: docProp.title,
      titlePage: docProp.titlePage,
      version: docProp.version,
    }
  }, [docProp.id, docProp.title, docProp.titlePage, docProp.version])

  const t = themeOverride ?? THEMES[theme]
  const isDark = theme === 'parchment' || theme === 'midnight'

  const isReadOnly = viewMode === 'read'

  // ─── Active Scene / Focus Tracking ───

  const handleSelectionUpdate = useCallback(({ editor }: { editor: any }) => {
    if (!editor) return

    const { $from } = editor.state.selection
    const currentNode = $from.parent
    const currentNodeName = currentNode.type.name
    const currentBlockType = NODE_TO_BLOCK[currentNodeName]
    const currentBlockId = currentNode.attrs?.id || ''

    // Report focused element
    if (currentBlockType && onFocusedElementInfo) {
      onFocusedElementInfo({ type: currentBlockType, blockId: currentBlockId })
    }

    // Walk backwards from current position to find the nearest scene heading
    const doc = editor.state.doc
    const currentIndex = $from.index(0)

    for (let i = currentIndex; i >= 0; i--) {
      const node = doc.child(i)
      if (node.type.name === 'sceneHeading') {
        const headingId = node.attrs?.id
        if (headingId && headingId !== activeSceneId) {
          lastActiveSceneFromCursorRef.current = headingId
          onActiveSceneChange(headingId)
        }
        return
      }
    }

    // No scene heading found above cursor — find the first one in the doc
    for (let i = 0; i < doc.childCount; i++) {
      const node = doc.child(i)
      if (node.type.name === 'sceneHeading') {
        const headingId = node.attrs?.id || ''
        if (headingId !== activeSceneId) {
          lastActiveSceneFromCursorRef.current = headingId
          onActiveSceneChange(headingId)
        }
        break
      }
    }
    // Report selected text for Kleo integration
    if (onSelectionTextChange) {
      const { from, to } = editor.state.selection
      const selectedText = from !== to ? editor.state.doc.textBetween(from, to, '\n') : ''
      onSelectionTextChange(selectedText)
    }
  }, [activeSceneId, onActiveSceneChange, onFocusedElementInfo, onSelectionTextChange])

  // ─── Editor Instance ───

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ScreenplayDoc,
      Text,
      HardBreak,
      Action,          // first block type = default after Cmd+A Delete
      SceneHeading,
      CharacterCue,
      Parenthetical,
      Dialogue,
      Transition,
      Bold,             // Cmd+B
      Italic,           // Cmd+I
      Underline,        // Cmd+U
      History,
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ node, editor: ed }) => {
          // Only show type-specific hint on the focused block
          if (!ed.isFocused) return ''
          const { $from } = ed.state.selection
          if ($from.parent !== node) return ''
          const name = node.type.name
          switch (name) {
            case 'sceneHeading': return 'INT./EXT. LOCATION - TIME'
            case 'action': return 'Type action, or press Tab for character'
            case 'characterCue': return 'CHARACTER NAME'
            case 'parenthetical': return 'wryly'
            case 'dialogue': return 'Dialogue...'
            case 'transition': return 'CUT TO:'
            default: return ''
          }
        },
      }),
      Dropcursor.configure({ color: 'var(--sf-cursor)', width: 2 }),
      Gapcursor,
      DualDialogueKeymap,
      FindReplaceKeymap,
      SceneNavKeymap,
      ContdDetection,
      NoteKeymap,
      PageBreakDecorations,
      createSceneLockFilter(metaMapRef),
    ],
    content: docToTiptap(docProp, metaMapRef.current),
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'sceneflow-tiptap-editor',
        spellcheck: 'true',
      },
      // Prevent clicks from landing on empty blocks or empty page space.
      // Must intercept at mousedown — handleClick fires too late (browser
      // already moved the native selection by then).
      handleDOMEvents: {
        mousedown: (view: any, event: Event) => {
          const mouseEvent = event as MouseEvent
          const target = mouseEvent.target as HTMLElement
          const editorEl = view.dom as HTMLElement

          // Resolve the click position to a ProseMirror doc position
          const coords = { left: mouseEvent.clientX, top: mouseEvent.clientY }
          const posAtCoords = view.posAtCoords(coords)
          if (!posAtCoords) return false

          const resolved = view.state.doc.resolve(posAtCoords.pos)
          const node = resolved.parent

          // Block clicks that land on empty blocks — no orphan placeholders
          if (node && node.type.name !== 'doc' && node.content.size === 0) {
            mouseEvent.preventDefault()
            return true
          }

          // Block clicks on the editor root / page break widgets (empty space)
          if (target === editorEl || target.closest('.sf-page-break-widget')) {
            mouseEvent.preventDefault()
            return true
          }

          return false
        },
      },
      handleTextInput: (view: any, from: number, to: number, text: string) => {
        const $from = view.state.doc.resolve(from)
        const parent = $from.parent
        const typeName = parent.type.name

        // ── Parenthetical: block stray ( ) ──
        if (typeName === 'parenthetical') {
          if (text === '(' && from === $from.start()) return true
          if (text === ')' && from === $from.end()) return true
        }

        // ── Character cue: auto-uppercase everything ──
        if (typeName === 'characterCue' && text !== text.toUpperCase()) {
          view.dispatch(view.state.tr.insertText(text.toUpperCase(), from, to))
          return true
        }

        // ── Auto-capitalize: first char of block + after . ? ! ──
        if (text.length === 1 && /[a-z]/.test(text)) {
          const offset = $from.parentOffset
          // First character in the block
          if (offset === 0) {
            view.dispatch(view.state.tr.insertText(text.toUpperCase(), from, to))
            return true
          }
          // After sentence-ending punctuation + space
          if (offset >= 2) {
            const prev = parent.textContent.slice(offset - 2, offset)
            if (prev === '. ' || prev === '? ' || prev === '! ') {
              view.dispatch(view.state.tr.insertText(text.toUpperCase(), from, to))
              return true
            }
          }
        }

        return false
      },
      handleKeyDown: (_view: any, event: KeyboardEvent) => {
        // ── Scene heading autocomplete navigation ──
        if (shActiveRef.current && shSuggestionsRef.current.length > 0) {
          const shList = shSuggestionsRef.current
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = Math.min(shIndexRef.current + 1, shList.length - 1)
            shIndexRef.current = next
            setShIndex(next)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = Math.max(shIndexRef.current - 1, 0)
            shIndexRef.current = next
            setShIndex(next)
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const item = shList[shIndexRef.current]
            if (item && editor) {
              const { $from } = editor.state.selection
              const fullText = $from.parent.textContent
              const mode = shModeRef.current

              if (mode === 'location') {
                // Replace everything after the prefix (INT. /EXT. /INT./EXT. ) with location
                const prefixMatch = fullText.match(/^(INT\.\s*\/?\s*EXT\.\s+|EXT\.\s+|INT\.\s+)/i)
                const prefixLen = prefixMatch ? prefixMatch[0].length : 0
                const start = $from.start() + prefixLen
                const end = $from.end()
                editor.chain()
                  .deleteRange({ from: start, to: end })
                  .insertContent(item)
                  .run()
              } else {
                // Time suffix — append after a space if needed
                const cursorPos = $from.pos
                const endPos = $from.end()
                // Find where to insert: after the location, replace any partial time-of-day text
                const dashIdx = fullText.lastIndexOf(' - ')
                if (dashIdx !== -1) {
                  const start = $from.start() + dashIdx
                  editor.chain()
                    .deleteRange({ from: start, to: endPos })
                    .insertContent(' ' + item)
                    .run()
                } else {
                  editor.chain()
                    .deleteRange({ from: cursorPos, to: endPos })
                    .insertContent(' ' + item)
                    .run()
                }
              }
            }
            shSuggestionsRef.current = []
            shActiveRef.current = false
            setShSuggestions([])
            return true
          }
          if (event.key === 'Escape') {
            shSuggestionsRef.current = []
            shActiveRef.current = false
            setShSuggestions([])
            return true
          }
        }

        // ── Extension dropdown navigation (V.O., O.S., etc.) ──
        if (extActiveRef.current && extSuggestionsRef.current.length > 0) {
          const extList = extSuggestionsRef.current
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            const next = Math.min(extIndexRef.current + 1, extList.length - 1)
            extIndexRef.current = next
            setExtIndex(next)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            const next = Math.max(extIndexRef.current - 1, 0)
            extIndexRef.current = next
            setExtIndex(next)
            return true
          }
          if (event.key === 'Tab' || event.key === 'Enter') {
            event.preventDefault()
            const ext = extList[extIndexRef.current]
            if (ext && editor) {
              const { $from } = editor.state.selection
              const nodeText = $from.parent.textContent
              // Find the trailing `(` and replace from there to end
              const parenIdx = nodeText.lastIndexOf('(')
              if (parenIdx !== -1) {
                const start = $from.start() + parenIdx
                const end = $from.end()
                editor.chain()
                  .deleteRange({ from: start, to: end })
                  .insertContent(`(${ext})`)
                  .run()
              }
            }
            extSuggestionsRef.current = []
            extActiveRef.current = false
            setExtSuggestions([])
            return true
          }
          if (event.key === 'Escape') {
            extSuggestionsRef.current = []
            extActiveRef.current = false
            setExtSuggestions([])
            return true
          }
        }

        // ── Character name autocomplete navigation ──
        if (!acActiveRef.current || acSuggestionsRef.current.length === 0) return false
        const suggestions = acSuggestionsRef.current

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          const next = Math.min(acIndexRef.current + 1, suggestions.length - 1)
          acIndexRef.current = next
          setAcIndex(next)
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          const next = Math.max(acIndexRef.current - 1, 0)
          acIndexRef.current = next
          setAcIndex(next)
          return true
        }
        if (event.key === 'Tab' || event.key === 'Enter') {
          event.preventDefault()
          const name = suggestions[acIndexRef.current]
          if (name && editor) {
            const { $from } = editor.state.selection
            const start = $from.start()
            const end = $from.end()
            editor.chain()
              .deleteRange({ from: start, to: end })
              .insertContent(name)
              .run()
          }
          acSuggestionsRef.current = []
          acActiveRef.current = false
          setAcSuggestions([])
          return true
        }
        if (event.key === 'Escape') {
          acSuggestionsRef.current = []
          acActiveRef.current = false
          setAcSuggestions([])
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (settingContentRef.current) return
      const json = editor.getJSON()
      const meta = docMetaRef.current
      const newDoc = tiptapToDoc(json, meta, metaMapRef.current)
      docMetaRef.current.version = newDoc.version
      lastDocVersionRef.current = newDoc.version
      onDocChange(newDoc)

      // ─── Character autocomplete + extension dropdown on typing ───
      const { $from } = editor.state.selection
      const node = $from.parent
      if (node.type.name === 'characterCue') {
        if (shActiveRef.current) updateShSuggestions([])
        const fullText = node.textContent
        const trimmed = fullText.trim()

        // Check for extension trigger: character name followed by ` (` with optional partial typing
        const parenMatch = trimmed.match(/\S+\s+\(([A-Z.']*)?$/)
        if (parenMatch) {
          const partialExt = (parenMatch[1] || '').toUpperCase()
          const filtered = EXT_OPTIONS.filter(e => e.startsWith(partialExt))
          if (filtered.length > 0) {
            const coords = editor.view.coordsAtPos($from.pos)
            updateExtSuggestions(filtered)
            updateExtIndex(0)
            setExtCoords({ top: coords.bottom + 4, left: coords.left })
          } else {
            updateExtSuggestions([])
          }
          if (acActiveRef.current) updateAcSuggestions([])
        } else {
          if (extActiveRef.current) updateExtSuggestions([])

          // Character name autocomplete
          const typed = trimmed.toUpperCase()
          if (typed.length >= 1) {
            const names = new Set<string>()
            editor.state.doc.descendants((n: any) => {
              if (n.type.name === 'characterCue' && n.textContent.trim()) {
                const name = n.textContent.trim().replace(/\s*\(.*\)$/, '').toUpperCase()
                if (name && name !== typed) names.add(name)
              }
            })
            const matches = Array.from(names).filter(n => n.startsWith(typed)).sort()
            if (matches.length > 0) {
              const coords = editor.view.coordsAtPos($from.pos)
              updateAcSuggestions(matches)
              updateAcIndex(0)
              setAcCoords({ top: coords.bottom + 4, left: coords.left })
            } else {
              updateAcSuggestions([])
            }
          } else {
            updateAcSuggestions([])
          }
        }
      } else if (node.type.name === 'sceneHeading') {
        // ─── Scene heading autocomplete on typing ───
        if (acActiveRef.current) updateAcSuggestions([])
        if (extActiveRef.current) updateExtSuggestions([])

        const fullText = node.textContent
        const prefixMatch = fullText.match(/^(INT\.\s*\/?\s*EXT\.\s+|EXT\.\s+|INT\.\s+)/i)

        if (prefixMatch) {
          const afterPrefix = fullText.slice(prefixMatch[0].length)

          // Check if user is typing a time-of-day suffix (has " - " already)
          const dashMatch = afterPrefix.match(/^(.+?)\s+-\s*(.*)$/i)
          if (dashMatch) {
            // User has typed location + " - " — suggest time suffixes
            const partialTime = ('- ' + dashMatch[2]).toUpperCase()
            const timeMatches = SH_TIME_SUFFIXES.filter(t => t.startsWith(partialTime))
            if (timeMatches.length > 0) {
              const coords = editor.view.coordsAtPos($from.pos)
              updateShSuggestions(timeMatches, 'time')
              updateShIndex(0)
              setShCoords({ top: coords.bottom + 4, left: coords.left })
            } else {
              updateShSuggestions([])
            }
          } else {
            // User is typing a location — suggest from existing locations
            const typedLoc = afterPrefix.toUpperCase().trim()
            if (typedLoc.length >= 1) {
              const locations = new Set<string>()
              editor.state.doc.descendants((n: any) => {
                if (n.type.name === 'sceneHeading' && n.textContent.trim()) {
                  const heading = n.textContent.trim()
                  const locMatch = heading.match(/^(?:INT\.\s*\/?\s*EXT\.\s+|EXT\.\s+|INT\.\s+)(.+?)(?:\s+-\s+\w+.*)?$/i)
                  if (locMatch) {
                    const loc = locMatch[1].trim().toUpperCase()
                    if (loc && loc !== typedLoc) locations.add(loc)
                  }
                }
              })
              const matches = Array.from(locations).filter(l => l.startsWith(typedLoc)).sort()
              if (matches.length > 0) {
                const coords = editor.view.coordsAtPos($from.pos)
                updateShSuggestions(matches, 'location')
                updateShIndex(0)
                setShCoords({ top: coords.bottom + 4, left: coords.left })
              } else {
                updateShSuggestions([])
              }
            } else {
              // Just the prefix typed (INT. / EXT. ) with nothing after — don't show autocomplete yet
              // User needs to type at least 1 character to see suggestions
              updateShSuggestions([])
            }
          }
        } else {
          if (shActiveRef.current) updateShSuggestions([])
        }
      } else {
        if (acActiveRef.current) updateAcSuggestions([])
        if (extActiveRef.current) updateExtSuggestions([])
        if (shActiveRef.current) updateShSuggestions([])
      }
    },
    onSelectionUpdate: handleSelectionUpdate,
  })

  // ─── Expose editor to parent for Kleo insert/replace ───

  useEffect(() => {
    if (editor && editorRef) editorRef(editor)
  }, [editor, editorRef])

  // ─── Sync editable state ───

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly)
    }
  }, [editor, isReadOnly])

  // ─── Sync external doc changes into editor ───

  const lastDocIdRef = useRef(docProp.id)

  useEffect(() => {
    if (!editor) return

    // If the doc ID changed (new file loaded, FDX import), always force sync
    const isNewDoc = docProp.id !== lastDocIdRef.current
    if (!isNewDoc && docProp.version <= lastDocVersionRef.current) return

    const newContent = docToTiptap(docProp, metaMapRef.current)

    if (!isNewDoc) {
      const currentContent = editor.getJSON()
      if (contentEquals(currentContent, newContent)) {
        lastDocVersionRef.current = docProp.version
        return
      }
    }

    settingContentRef.current = true
    editor.commands.setContent(newContent)
    settingContentRef.current = false
    lastDocVersionRef.current = docProp.version
    lastDocIdRef.current = docProp.id
  }, [editor, docProp])

  // ─── Scroll to scene on sidebar click (Issue #6) ───

  useEffect(() => {
    if (!editor || !activeSceneId) return
    // Skip scroll when the active scene changed from cursor movement
    if (activeSceneId === lastActiveSceneFromCursorRef.current) return

    const { doc } = editor.state
    let targetPos: number | null = null
    doc.descendants((node, pos) => {
      if (node.type.name === 'sceneHeading' && node.attrs?.id === activeSceneId) {
        targetPos = pos
        return false
      }
    })
    if (targetPos !== null) {
      const domNode = editor.view.nodeDOM(targetPos)
      if (domNode && domNode instanceof HTMLElement) {
        domNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [editor, activeSceneId])

  // ─── Page breaks for page view ───

  const pageBreaks = useMemo(() => {
    return computePageBreaks(docProp.blocks)
  }, [docProp.blocks])

  // ─── Full page layout with CONT'D tracking ───

  const pageLayout = useMemo(() => {
    return computePageLayout(docProp.blocks)
  }, [docProp.blocks])

  const totalPages = useMemo(() => {
    if (pageBreaks.size === 0) return 1
    let max = 1
    for (const p of pageBreaks.values()) {
      if (p > max) max = p
    }
    return max
  }, [pageBreaks])

  // ─── Sync theme colors into page break plugin ───

  useEffect(() => {
    if (!editor) return
    const ext = editor.extensionManager.extensions.find(
      (e: any) => e.name === 'pageBreakDecorations'
    )
    if (!ext) return

    const storage = ext.storage as PageBreakStorage
    storage.themeColors = {
      desk: t.desk,
      paper: t.paper,
      inkFaint: t.inkFaint,
      pageBreak: t.pageBreak,
      font: SCREENPLAY_FONT,
    }
  }, [editor, t])

  // ─── Check if doc is empty (Issue #11: tightened to check ALL blocks) ───

  const isEmpty = useMemo(() => {
    return docProp.blocks.length === 0 ||
      docProp.blocks.every(b => b.text.trim() === '')
  }, [docProp.blocks])

  // ─── Page indicator: track current page from scroll position (Issue #12) ───

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (totalPages <= 1) return
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollable = container.scrollHeight - container.clientHeight
      if (scrollable <= 0) { setCurrentPage(1); return }
      const scrollFraction = container.scrollTop / scrollable
      const page = Math.max(1, Math.min(totalPages, Math.ceil(scrollFraction * totalPages) || 1))
      setCurrentPage(page)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [totalPages])

  // ─── Typewriter mode: keep cursor centered ───

  useEffect(() => {
    if (!editor || !typewriterMode) return

    const scrollToCursor = () => {
      const { view } = editor
      const { from } = view.state.selection
      const coords = view.coordsAtPos(from)
      const editorEl = view.dom.closest('.sceneflow-editor-scroll')
      if (!editorEl) return

      const containerRect = editorEl.getBoundingClientRect()
      const offset = coords.top - containerRect.top - containerRect.height / 2
      editorEl.scrollBy({ top: offset, behavior: 'smooth' })
    }

    editor.on('selectionUpdate', scrollToCursor)
    return () => { editor.off('selectionUpdate', scrollToCursor) }
  }, [editor, typewriterMode])

  // ─── Cmd+F: Toggle find bar via custom event from FindReplaceKeymap ───

  useEffect(() => {
    const handleToggleFind = () => setShowFind(prev => !prev)
    window.addEventListener('sceneflow:toggle-find', handleToggleFind)
    return () => window.removeEventListener('sceneflow:toggle-find', handleToggleFind)
  }, [])

  // ─── Cmd+D: Toggle dual dialogue meta via custom event from DualDialogueKeymap ───

  useEffect(() => {
    const handleToggleDual = (e: Event) => {
      const { blockIds } = (e as CustomEvent).detail as { blockIds: string[] }
      if (!blockIds.length || !editor) return

      const doc = editor.state.doc
      const dialogueTypes = new Set(['characterCue', 'dialogue', 'parenthetical'])

      // Toggle off: if the first block already has dual set, remove dual from ALL blocks
      const firstMeta = metaMapRef.current.get(blockIds[0]) ?? {}
      if (firstMeta.dual) {
        doc.forEach((node: any) => {
          const id = node.attrs?.id
          if (id) {
            const meta = metaMapRef.current.get(id)
            if (meta?.dual) {
              delete meta.dual
              metaMapRef.current.set(id, meta)
            }
          }
        })
      } else {
        // Toggle on: mark current group as 'left', find the adjacent group and mark as 'right'
        // Find the end index of the current group in the doc
        let currentGroupEndIndex = -1
        for (let i = 0; i < doc.childCount; i++) {
          const node = doc.child(i)
          if (blockIds.includes(node.attrs?.id)) {
            currentGroupEndIndex = i
          }
        }

        // Find the next dialogue group (starts with the next characterCue after the current group)
        const rightGroupIds: string[] = []
        let foundNextCharacter = false
        for (let i = currentGroupEndIndex + 1; i < doc.childCount; i++) {
          const node = doc.child(i)
          const typeName = node.type.name
          if (typeName === 'characterCue' && !foundNextCharacter) {
            foundNextCharacter = true
            rightGroupIds.push(node.attrs?.id)
          } else if (foundNextCharacter && dialogueTypes.has(typeName)) {
            if (typeName === 'characterCue') break // hit a third group, stop
            rightGroupIds.push(node.attrs?.id)
          } else if (foundNextCharacter) {
            break // non-dialogue block ends the group
          }
        }

        // If no adjacent group found, check the previous group instead
        if (rightGroupIds.length === 0) {
          let currentGroupStartIndex = doc.childCount
          for (let i = 0; i < doc.childCount; i++) {
            if (blockIds.includes(doc.child(i).attrs?.id)) {
              currentGroupStartIndex = i
              break
            }
          }
          // Walk backwards to find previous dialogue group
          let prevGroupEnd = -1
          for (let i = currentGroupStartIndex - 1; i >= 0; i--) {
            const node = doc.child(i)
            if (dialogueTypes.has(node.type.name)) {
              if (prevGroupEnd === -1) prevGroupEnd = i
              rightGroupIds.unshift(node.attrs?.id)
              if (node.type.name === 'characterCue') break
            } else {
              break
            }
          }
          // Swap: the previous group becomes 'left', current becomes 'right'
          if (rightGroupIds.length > 0) {
            for (const id of rightGroupIds) {
              const meta = metaMapRef.current.get(id) ?? {}
              meta.dual = 'left'
              metaMapRef.current.set(id, meta)
            }
            for (const id of blockIds) {
              const meta = metaMapRef.current.get(id) ?? {}
              meta.dual = 'right'
              metaMapRef.current.set(id, meta)
            }
            rightGroupIds.length = 0 // already handled
          }
        }

        // Standard case: current = left, next = right
        if (rightGroupIds.length > 0) {
          for (const id of blockIds) {
            const meta = metaMapRef.current.get(id) ?? {}
            meta.dual = 'left'
            metaMapRef.current.set(id, meta)
          }
          for (const id of rightGroupIds) {
            const meta = metaMapRef.current.get(id) ?? {}
            meta.dual = 'right'
            metaMapRef.current.set(id, meta)
          }
        } else if (!firstMeta.dual) {
          // No adjacent group found at all — just mark current as left (partial dual)
          for (const id of blockIds) {
            const meta = metaMapRef.current.get(id) ?? {}
            meta.dual = 'left'
            metaMapRef.current.set(id, meta)
          }
        }
      }

      // Trigger a doc update so the meta change propagates
      const json = editor.getJSON()
      const docMeta = docMetaRef.current
      const newDoc = tiptapToDoc(json, docMeta, metaMapRef.current)
      docMetaRef.current.version = newDoc.version
      lastDocVersionRef.current = newDoc.version
      onDocChange(newDoc)
    }
    window.addEventListener('sceneflow:toggle-dual', handleToggleDual)
    return () => window.removeEventListener('sceneflow:toggle-dual', handleToggleDual)
  }, [editor, onDocChange])

  // ─── Cmd+M: Toggle note annotation via custom event from NoteKeymap ───

  useEffect(() => {
    const handleToggleNote = (e: Event) => {
      const { blockId: bid } = (e as CustomEvent).detail as { blockId: string }
      if (!bid || !editor) return

      if (noteBlockId === bid) {
        setNoteBlockId(null)
        setNoteText('')
        setNoteCoords(null)
        return
      }

      const existingMeta = metaMapRef.current.get(bid) ?? {}
      setNoteText(existingMeta.note || '')
      setNoteBlockId(bid)

      try {
        const doc = editor.state.doc
        let targetPos: number | null = null
        doc.descendants((node, pos) => {
          if (node.attrs?.id === bid) {
            targetPos = pos
            return false
          }
        })
        if (targetPos !== null) {
          const coords = editor.view.coordsAtPos(targetPos)
          setNoteCoords({ top: coords.top, left: coords.right + 40 })
        }
      } catch (_) {
        setNoteCoords({ top: 200, left: 600 })
      }

      setTimeout(() => noteTextareaRef.current?.focus(), 50)
    }
    window.addEventListener('sceneflow:toggle-note', handleToggleNote)
    return () => window.removeEventListener('sceneflow:toggle-note', handleToggleNote)
  }, [editor, noteBlockId])

  const saveNote = useCallback(() => {
    if (!noteBlockId || !editor) return
    const trimmed = noteText.trim()
    const meta = metaMapRef.current.get(noteBlockId) ?? {}
    if (trimmed) {
      meta.note = trimmed
    } else {
      delete meta.note
    }
    metaMapRef.current.set(noteBlockId, meta)

    const json = editor.getJSON()
    const docMeta = docMetaRef.current
    const newDoc = tiptapToDoc(json, docMeta, metaMapRef.current)
    docMetaRef.current.version = newDoc.version
    lastDocVersionRef.current = newDoc.version
    onDocChange(newDoc)

    setNoteBlockId(null)
    setNoteText('')
    setNoteCoords(null)
  }, [noteBlockId, noteText, editor, onDocChange])

  const deleteNote = useCallback(() => {
    if (!noteBlockId || !editor) return
    const meta = metaMapRef.current.get(noteBlockId) ?? {}
    delete meta.note
    metaMapRef.current.set(noteBlockId, meta)

    const json = editor.getJSON()
    const docMeta = docMetaRef.current
    const newDoc = tiptapToDoc(json, docMeta, metaMapRef.current)
    docMetaRef.current.version = newDoc.version
    lastDocVersionRef.current = newDoc.version
    onDocChange(newDoc)

    setNoteBlockId(null)
    setNoteText('')
    setNoteCoords(null)
  }, [noteBlockId, editor, onDocChange])

  // ─── Note indicators: mark blocks with notes via data-has-note ───

  useEffect(() => {
    if (!editor) return

    const updateNoteIndicators = () => {
      const editorEl = editor.view.dom
      editorEl.querySelectorAll('[data-has-note]').forEach((el: Element) =>
        el.removeAttribute('data-has-note')
      )

      const doc = editor.state.doc
      doc.descendants((node, pos) => {
        const id = node.attrs?.id
        if (id) {
          const meta = metaMapRef.current.get(id)
          if (meta?.note) {
            try {
              const domNode = editor.view.nodeDOM(pos)
              if (domNode instanceof HTMLElement) {
                domNode.setAttribute('data-has-note', 'true')
              }
            } catch (_) { /* node not in view */ }
          }
        }
      })
    }

    updateNoteIndicators()
    editor.on('update', updateNoteIndicators)
    editor.on('selectionUpdate', updateNoteIndicators)
    return () => {
      editor.off('update', updateNoteIndicators)
      editor.off('selectionUpdate', updateNoteIndicators)
    }
  }, [editor])

  // ─── Dual dialogue indicators: mark blocks with data-dual attribute ───

  useEffect(() => {
    if (!editor) return

    const updateDualIndicators = () => {
      const editorEl = editor.view.dom
      editorEl.querySelectorAll('[data-dual]').forEach((el: Element) =>
        el.removeAttribute('data-dual')
      )
      editorEl.querySelectorAll('.sp-dual-clear').forEach((el: Element) =>
        el.classList.remove('sp-dual-clear')
      )

      const doc = editor.state.doc
      let lastWasDual = false

      doc.descendants((node, pos) => {
        const id = node.attrs?.id
        if (!id) return
        const meta = metaMapRef.current.get(id)
        if (meta?.dual) {
          try {
            const domNode = editor.view.nodeDOM(pos)
            if (domNode instanceof HTMLElement) {
              domNode.setAttribute('data-dual', meta.dual)
              lastWasDual = true
            }
          } catch (_) { /* node not in view */ }
        } else if (lastWasDual) {
          try {
            const domNode = editor.view.nodeDOM(pos)
            if (domNode instanceof HTMLElement) {
              domNode.classList.add('sp-dual-clear')
            }
          } catch (_) { /* node not in view */ }
          lastWasDual = false
        }
      })
    }

    updateDualIndicators()
    editor.on('update', updateDualIndicators)
    editor.on('selectionUpdate', updateDualIndicators)
    return () => {
      editor.off('update', updateDualIndicators)
      editor.off('selectionUpdate', updateDualIndicators)
    }
  }, [editor])

  // ─── Locked block indicators: mark blocks with data-scene-locked ───

  useEffect(() => {
    if (!editor) return

    const updateLockedIndicators = () => {
      const editorEl = editor.view.dom
      editorEl.querySelectorAll('[data-scene-locked]').forEach((el: Element) =>
        el.removeAttribute('data-scene-locked')
      )

      const doc = editor.state.doc
      doc.descendants((node, pos) => {
        const id = node.attrs?.id
        if (id) {
          const meta = metaMapRef.current.get(id)
          if (meta?.locked) {
            try {
              const domNode = editor.view.nodeDOM(pos)
              if (domNode instanceof HTMLElement) {
                domNode.setAttribute('data-scene-locked', 'true')
              }
            } catch (_) { /* node not in view */ }
          }
        }
      })
    }

    updateLockedIndicators()
    editor.on('update', updateLockedIndicators)
    editor.on('selectionUpdate', updateLockedIndicators)
    return () => {
      editor.off('update', updateLockedIndicators)
      editor.off('selectionUpdate', updateLockedIndicators)
    }
  }, [editor])

  // ─── Scene number indicators: stamp data-scene-number on heading DOM nodes ───

  useEffect(() => {
    if (!editor) return

    const updateSceneNumbers = () => {
      const editorEl = editor.view.dom
      editorEl.querySelectorAll('[data-scene-number]').forEach((el: Element) =>
        el.removeAttribute('data-scene-number')
      )

      const doc = editor.state.doc
      let autoIndex = 0
      doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          autoIndex++
          const id = node.attrs?.id
          const meta = id ? metaMapRef.current.get(id) : null
          const num = meta?.sceneNumber ?? String(autoIndex)
          try {
            const domNode = editor.view.nodeDOM(pos)
            if (domNode instanceof HTMLElement) {
              domNode.setAttribute('data-scene-number', num)
            }
          } catch (_) { /* node not in view */ }
        }
      })
    }

    updateSceneNumbers()
    editor.on('update', updateSceneNumbers)
    editor.on('selectionUpdate', updateSceneNumbers)
    return () => {
      editor.off('update', updateSceneNumbers)
      editor.off('selectionUpdate', updateSceneNumbers)
    }
  }, [editor])

  // ─── Dismiss autocomplete + extension dropdown on editor blur ───

  useEffect(() => {
    if (!editor) return
    const handleBlur = () => {
      setTimeout(() => {
        updateAcSuggestions([])
        updateExtSuggestions([])
      }, 150)
    }
    editor.on('blur', handleBlur)
    return () => { editor.off('blur', handleBlur) }
  }, [editor, updateAcSuggestions, updateExtSuggestions])

  if (!editor) return null

  // ─── Style Computation ───

  const isPageView = scriptView === 'page'

  const editorStyles = `
    .sceneflow-editor-scroll { --sf-cursor: ${t.cursor}; }
    .sceneflow-tiptap-editor {
      font-family: ${SCREENPLAY_FONT};
      font-size: ${FONT_SIZE};
      line-height: ${LINE_HEIGHT};
      color: ${t.ink};
      caret-color: ${t.cursor};
      outline: none;
      min-height: 100%;
      padding: 0;
    }
    .sceneflow-tiptap-editor .sp-scene-heading {
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 2em;
      margin-bottom: 1em;
      position: relative;
    }
    .sceneflow-tiptap-editor .sp-scene-heading::before {
      content: attr(data-scene-number);
      position: absolute;
      left: -40px;
      font-size: 11px;
      opacity: ${isPageView ? '0.55' : '0.35'};
      font-weight: 400;
      ${isPageView ? `
        left: -60px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.5px;
      ` : ''}
    }
    ${isPageView ? `
      .sceneflow-tiptap-editor .sp-scene-heading:not([data-scene-locked="true"])::after {
        content: attr(data-scene-number);
        position: absolute;
        right: -60px;
        top: 0;
        font-size: 12px;
        opacity: 0.55;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
    ` : ''}
    .sceneflow-tiptap-editor .sp-action {
      margin-top: 1em;
    }
    .sceneflow-tiptap-editor .sp-character {
      margin-left: 33.3%;
      max-width: 66.7%;
      text-transform: uppercase;
      margin-top: 1em;
    }
    .sceneflow-tiptap-editor .sp-character[data-contd="true"]::after {
      content: ' (CONT\\'D)';
    }
    .sceneflow-tiptap-editor .sp-parenthetical {
      margin-left: 25%;
      max-width: 38.4%;
    }
    .sceneflow-tiptap-editor .sp-dialogue {
      margin-left: 16.7%;
      max-width: 58.3%;
    }
    .sceneflow-tiptap-editor .sp-transition {
      text-align: right;
      text-transform: uppercase;
      margin-top: 1em;
      margin-bottom: 1em;
    }

    /* Placeholder styles */
    .sceneflow-tiptap-editor .is-empty::before {
      content: attr(data-placeholder);
      float: left;
      color: ${t.inkFaint};
      pointer-events: none;
      height: 0;
    }
    /* Parenthetical placeholder: wrap with () to match visual parens */
    .sceneflow-tiptap-editor .sp-parenthetical.is-empty::before {
      content: '(' attr(data-placeholder) ')';
    }
    .sceneflow-tiptap-editor .sp-parenthetical.is-empty::after {
      content: '';
    }


    /* Read mode: condensed layout */
    ${isReadOnly ? `
      .sceneflow-tiptap-editor .sp-scene-heading { margin-top: 1.2em; margin-bottom: 0.5em; }
      .sceneflow-tiptap-editor .sp-action { margin-top: 0.5em; }
      .sceneflow-tiptap-editor .sp-character { margin-top: 0.5em; }
      .sceneflow-tiptap-editor .sp-transition { margin-top: 0.5em; margin-bottom: 0.5em; }
    ` : ''}

    /* ─── Page Break Widget Decorations ─── */
      .sf-page-break-widget {
        user-select: none;
        pointer-events: none;
        position: relative;
        /* Extend beyond the paper padding to full page width */
        margin: 0 -${PAGE_PADDING_RIGHT}px 0 -${PAGE_PADDING_LEFT}px;
        width: calc(100% + ${PAGE_PADDING_LEFT + PAGE_PADDING_RIGHT}px);
        /* Bottom margin of prev page + gap + top margin of next page */
        padding: ${PAGE_PADDING_BOTTOM}px 0 ${PAGE_PADDING_TOP}px 0;
        background: ${t.paper};
      }

      .sf-page-gap {
        height: 40px;
        background: ${t.desk};
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 ${PAGE_PADDING_RIGHT}px;
        position: relative;
        /* Simulate two separate page cards with inset shadows — lighter on light themes */
        box-shadow:
          inset 0 12px 16px -8px rgba(0,0,0,${isDark ? 0.5 : 0.15}),
          inset 0 -12px 16px -8px rgba(0,0,0,${isDark ? 0.5 : 0.15}),
          0 0 0 1px rgba(0,0,0,${isDark ? 0.15 : 0.08});
      }

      .sf-page-gap::before,
      .sf-page-gap::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 1px;
        pointer-events: none;
      }
      .sf-page-gap::before {
        top: 0;
        background: linear-gradient(
          90deg,
          transparent 5%,
          rgba(0,0,0,${isDark ? 0.2 : 0.08}) 20%,
          rgba(0,0,0,${isDark ? 0.3 : 0.12}) 50%,
          rgba(0,0,0,${isDark ? 0.2 : 0.08}) 80%,
          transparent 95%
        );
      }
      .sf-page-gap::after {
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent 5%,
          rgba(0,0,0,${isDark ? 0.2 : 0.08}) 20%,
          rgba(0,0,0,${isDark ? 0.3 : 0.12}) 50%,
          rgba(0,0,0,${isDark ? 0.2 : 0.08}) 80%,
          transparent 95%
        );
      }

      .sf-page-gap-prev {
        display: none;
      }

      .sf-page-gap-next {
        font-size: 10px;
        color: ${t.inkFaint};
        opacity: 0.6;
        letter-spacing: 0.5px;
      }

      .sf-page-more {
        text-align: center;
        font-size: 12px;
        color: ${t.inkFaint};
        padding: 8px ${PAGE_PADDING_RIGHT}px 4px ${PAGE_PADDING_LEFT}px;
        margin-left: 16.7%;
        margin-right: 25%;
      }

      .sf-page-contd {
        text-align: center;
        font-size: 12px;
        color: ${t.inkFaint};
        text-transform: uppercase;
        padding: 4px ${PAGE_PADDING_RIGHT}px 8px ${PAGE_PADDING_LEFT}px;
        margin-left: 33.3%;
        margin-right: 25%;
      }

    /* ─── Dual Dialogue: side-by-side layout ─── */
    .sceneflow-tiptap-editor [data-dual="left"] {
      float: left;
      width: 48%;
      clear: left;
      margin-left: 0;
      max-width: 48%;
    }
    .sceneflow-tiptap-editor [data-dual="right"] {
      float: right;
      width: 48%;
      clear: right;
      margin-left: 0;
      max-width: 48%;
      border-left: 1px solid ${t.inkFaint};
      padding-left: 8px;
    }
    .sceneflow-tiptap-editor .sp-character[data-dual] {
      margin-left: 20%;
      max-width: 80%;
    }
    .sceneflow-tiptap-editor .sp-dialogue[data-dual] {
      margin-left: 8%;
      max-width: 90%;
    }
    .sceneflow-tiptap-editor .sp-parenthetical[data-dual] {
      margin-left: 14%;
      max-width: 72%;
    }
    .sceneflow-tiptap-editor [data-dual="right"].sp-character {
      margin-top: 1em;
    }
    .sceneflow-tiptap-editor .sp-dual-clear {
      clear: both;
    }

    /* Watermark */
    .sceneflow-watermark {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      font-size: 11px;
      color: ${t.inkFaint};
      opacity: 0.4;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }

    /* Page indicator */
    .sceneflow-page-indicator {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      color: ${t.inkFaint};
      opacity: 0.6;
      pointer-events: none;
      user-select: none;
      z-index: 1;
      font-family: ${SCREENPLAY_FONT};
    }

    /* Search highlight (CSS Custom Highlight API) */
    ::highlight(search-highlight) {
      background-color: rgba(255, 200, 0, 0.35);
      color: inherit;
    }

    /* Note indicators: subtle left border + dot on blocks with notes */
    .sceneflow-tiptap-editor [data-has-note="true"] {
      border-left: 2px solid ${t.cursor};
      padding-left: 6px;
      position: relative;
    }
    .sceneflow-tiptap-editor [data-has-note="true"]::before {
      position: absolute;
      right: -16px;
      top: 4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${t.cursor};
      opacity: 0.6;
    }
    /* Avoid conflicting with scene-heading scene number ::before — use ::after for note dot there */
    .sceneflow-tiptap-editor .sp-scene-heading[data-has-note="true"]::before {
      /* Keep the scene number; skip the note dot on ::before */
    }

    /* Note popover styles */
    .sceneflow-note-popover {
      position: fixed;
      z-index: 60;
      background: ${t.paper};
      border: 1px solid ${t.inkFaint};
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      padding: 10px;
      width: 240px;
      font-family: ${SCREENPLAY_FONT};
      font-size: 12px;
    }
    .sceneflow-note-popover textarea {
      width: 100%;
      background: transparent;
      border: 1px solid ${t.inkFaint};
      border-radius: 4px;
      color: ${t.ink};
      font-family: ${SCREENPLAY_FONT};
      font-size: 12px;
      line-height: 1.4;
      padding: 6px 8px;
      resize: vertical;
      min-height: 60px;
      outline: none;
    }
    .sceneflow-note-popover textarea:focus {
      border-color: ${t.cursor};
    }
    .sceneflow-note-popover-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      justify-content: flex-end;
    }
    .sceneflow-note-btn {
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid ${t.inkFaint};
      background: transparent;
      color: ${t.ink};
      font-size: 11px;
      cursor: pointer;
      font-family: ${SCREENPLAY_FONT};
    }
    .sceneflow-note-btn:hover {
      background: ${t.inkFaint};
      color: ${t.paper};
    }
    .sceneflow-note-btn-save {
      background: ${t.cursor};
      border-color: ${t.cursor};
      color: ${t.paper};
    }
    .sceneflow-note-btn-save:hover {
      opacity: 0.85;
    }
    .sceneflow-note-btn-delete {
      margin-right: auto;
      border-color: transparent;
      opacity: 0.6;
    }
    .sceneflow-note-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${t.inkFaint};
      margin-bottom: 6px;
    }

    /* ─── Locked scene blocks: subtle visual indicator ─── */
    .sceneflow-tiptap-editor [data-scene-locked="true"] {
      position: relative;
      opacity: 0.55;
      user-select: none;
      pointer-events: none;
      border-left: 2px solid ${t.cursor}30;
      padding-left: 6px;
    }
  `

  // ─── Page View Wrapper ───

  // Both Normal and Page view show a page-like wrapper (white page on dark desk).
  // Page view additionally shows page break decorations, MORE/CONT'D markers.
  const pageStyle: React.CSSProperties = {
    maxWidth: PAGE_WIDTH_PX,
    margin: '2rem auto 4rem',
    backgroundColor: t.paper,
    boxShadow: `0 2px 8px rgba(0,0,0,0.2), 0 8px 32px ${t.pageShadow}`,
    padding: `${PAGE_PADDING_TOP}px ${PAGE_PADDING_RIGHT}px ${PAGE_PADDING_BOTTOM}px ${PAGE_PADDING_LEFT}px`,
    minHeight: '1056px',
    position: 'relative',
    borderRadius: '2px',
  }

  // ─── Render ───

  return (
    <div
      ref={scrollContainerRef}
      className="sceneflow-editor-scroll"
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: t.desk,
        position: 'relative',
      }}
    >
      <style>{editorStyles}</style>

      {showFind && (
        <FindReplaceTiptap
          editor={editor}
          theme={theme}
          onClose={() => setShowFind(false)}
        />
      )}

      {isEmpty && !isReadOnly && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: t.inkFaint,
            fontFamily: SCREENPLAY_FONT,
            fontSize: '14px',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          Start writing your screenplay...
          <br />
          <span style={{ fontSize: '12px', opacity: 0.6 }}>
            Type INT. or EXT. to begin a scene
          </span>
        </div>
      )}

      <div style={pageStyle} data-page-wrapper>
        {/* Page 1 number — top right of first page (industry convention) */}
        {(
          <div
            style={{
              position: 'absolute',
              top: '24px',
              right: '36px',
              fontSize: '11px',
              color: t.inkFaint,
              userSelect: 'none',
              fontFamily: SCREENPLAY_FONT,
              letterSpacing: '0.5px',
            }}
          >
            1.
          </div>
        )}

        <EditorContent editor={editor} />

        {/* Page break decorations are now handled by the PageBreakDecorations ProseMirror plugin */}

        {/* Character autocomplete dropdown */}
        {acSuggestions.length > 0 && acCoords && (
          <div
            style={{
              position: 'fixed',
              top: acCoords.top,
              left: acCoords.left,
              zIndex: 50,
              background: t.paper,
              border: `1px solid ${t.inkFaint}`,
              borderRadius: 4,
              boxShadow: `0 4px 16px rgba(0,0,0,0.3)`,
              padding: '4px 0',
              minWidth: 160,
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: SCREENPLAY_FONT,
              fontSize: '13px',
            }}
          >
            {acSuggestions.map((name, i) => (
              <div
                key={name}
                style={{
                  padding: '4px 12px',
                  cursor: 'pointer',
                  color: i === acIndex ? t.paper : t.ink,
                  background: i === acIndex ? t.cursor : 'transparent',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (editor) {
                    const { $from } = editor.state.selection
                    const start = $from.start()
                    const end = $from.end()
                    editor.chain()
                      .deleteRange({ from: start, to: end })
                      .insertContent(name)
                      .run()
                  }
                  updateAcSuggestions([])
                }}
              >
                {name}
              </div>
            ))}
          </div>
        )}

        {/* Character extension dropdown (V.O., O.S., etc.) */}
        {extSuggestions.length > 0 && extCoords && (
          <div
            style={{
              position: 'fixed',
              top: extCoords.top,
              left: extCoords.left,
              zIndex: 50,
              background: t.paper,
              border: `1px solid ${t.inkFaint}`,
              borderRadius: 4,
              boxShadow: `0 4px 16px rgba(0,0,0,0.3)`,
              padding: '4px 0',
              minWidth: 100,
              fontFamily: SCREENPLAY_FONT,
              fontSize: '13px',
            }}
          >
            {extSuggestions.map((ext, i) => (
              <div
                key={ext}
                style={{
                  padding: '4px 12px',
                  cursor: 'pointer',
                  color: i === extIndex ? t.paper : t.ink,
                  background: i === extIndex ? t.cursor : 'transparent',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (editor) {
                    const { $from } = editor.state.selection
                    const nodeText = $from.parent.textContent
                    const parenIdx = nodeText.lastIndexOf('(')
                    if (parenIdx !== -1) {
                      const start = $from.start() + parenIdx
                      const end = $from.end()
                      editor.chain()
                        .deleteRange({ from: start, to: end })
                        .insertContent(`(${ext})`)
                        .run()
                    }
                  }
                  updateExtSuggestions([])
                }}
              >
                ({ext})
              </div>
            ))}
          </div>
        )}

        {/* Scene heading autocomplete dropdown */}
        {shSuggestions.length > 0 && shCoords && (
          <div
            style={{
              position: 'fixed',
              top: shCoords.top,
              left: shCoords.left,
              zIndex: 50,
              background: t.paper,
              border: `1px solid ${t.inkFaint}`,
              borderRadius: 4,
              boxShadow: `0 4px 16px rgba(0,0,0,0.3)`,
              padding: '4px 0',
              minWidth: 180,
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: SCREENPLAY_FONT,
              fontSize: '13px',
            }}
          >
            <div style={{
              padding: '2px 12px 4px',
              fontSize: '10px',
              color: t.inkFaint,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              {shMode === 'location' ? 'Locations' : 'Time of Day'}
            </div>
            {shSuggestions.map((item, i) => (
              <div
                key={item}
                style={{
                  padding: '4px 12px',
                  cursor: 'pointer',
                  color: i === shIndex ? t.paper : t.ink,
                  background: i === shIndex ? t.cursor : 'transparent',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (editor) {
                    const { $from } = editor.state.selection
                    const fullText = $from.parent.textContent
                    const mode = shModeRef.current

                    if (mode === 'location') {
                      const prefixMatch = fullText.match(/^(INT\.\s*\/?\s*EXT\.\s+|EXT\.\s+|INT\.\s+)/i)
                      const prefixLen = prefixMatch ? prefixMatch[0].length : 0
                      const start = $from.start() + prefixLen
                      const end = $from.end()
                      editor.chain()
                        .deleteRange({ from: start, to: end })
                        .insertContent(item)
                        .run()
                    } else {
                      const dashIdx = fullText.lastIndexOf(' - ')
                      if (dashIdx !== -1) {
                        const start = $from.start() + dashIdx
                        editor.chain()
                          .deleteRange({ from: start, to: $from.end() })
                          .insertContent(' ' + item)
                          .run()
                      } else {
                        editor.chain()
                          .deleteRange({ from: $from.pos, to: $from.end() })
                          .insertContent(' ' + item)
                          .run()
                      }
                    }
                  }
                  updateShSuggestions([])
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note annotation popover */}
      {noteBlockId && noteCoords && (
        <div
          className="sceneflow-note-popover"
          style={{ top: noteCoords.top, left: noteCoords.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="sceneflow-note-label">Note</div>
          <textarea
            ref={noteTextareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setNoteBlockId(null)
                setNoteText('')
                setNoteCoords(null)
                editor?.commands.focus()
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                saveNote()
                editor?.commands.focus()
              }
            }}
            placeholder="Add a note..."
          />
          <div className="sceneflow-note-popover-actions">
            {(metaMapRef.current.get(noteBlockId)?.note) && (
              <button
                className="sceneflow-note-btn sceneflow-note-btn-delete"
                onClick={() => {
                  deleteNote()
                  editor?.commands.focus()
                }}
              >
                Delete
              </button>
            )}
            <button
              className="sceneflow-note-btn"
              onClick={() => {
                setNoteBlockId(null)
                setNoteText('')
                setNoteCoords(null)
                editor?.commands.focus()
              }}
            >
              Cancel
            </button>
            <button
              className="sceneflow-note-btn sceneflow-note-btn-save"
              onClick={() => {
                saveNote()
                editor?.commands.focus()
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="sceneflow-page-indicator">
          Page {currentPage} of {totalPages}
        </div>
      )}

      {watermark && (
        <div className="sceneflow-watermark">{watermark}</div>
      )}
    </div>
  )
}

// ─── Drop-in replacement export ───

export const WritingArea = WritingAreaTiptap
