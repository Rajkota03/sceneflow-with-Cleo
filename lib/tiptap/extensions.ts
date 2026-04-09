import { Node, mergeAttributes, textblockTypeInputRule, InputRule, Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// ─── ID Generator ───
// Inline generator so blocks get stable IDs at creation time,
// preventing tiptapToDoc from re-generating IDs on every sync.
let _idCounter = 0
function generateId(): string {
  return `b_${Date.now()}_${++_idCounter}`
}

// ─── Types ───

type BlockType = 'sceneHeading' | 'action' | 'characterCue' | 'parenthetical' | 'dialogue' | 'transition'

// ─── Flow Rules ───
// What block type Enter creates after each type
const ENTER_CREATES: Record<BlockType, BlockType> = {
  sceneHeading: 'action',
  action: 'action',        // special: empty action -> character
  characterCue: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'sceneHeading',
}

// Tab cycles between these types
const TAB_CYCLE: Record<BlockType, BlockType> = {
  action: 'characterCue',
  characterCue: 'action',
  dialogue: 'parenthetical',
  parenthetical: 'dialogue',
  sceneHeading: 'action',
  transition: 'sceneHeading',
}

// Shift+Tab reverse cycle (opposite direction from Tab)
const SHIFT_TAB_CYCLE: Record<BlockType, BlockType> = {
  action: 'transition',
  characterCue: 'action',
  dialogue: 'parenthetical',
  parenthetical: 'dialogue',
  sceneHeading: 'transition',
  transition: 'action',
}

// Backspace-at-empty reverts to these types
const BACKSPACE_REVERTS: Record<BlockType, BlockType> = {
  dialogue: 'characterCue',
  characterCue: 'action',
  parenthetical: 'dialogue',
  transition: 'action',
  sceneHeading: 'action',
  action: 'action', // action stays action
}

// ─── Helpers ───

function isBlockEmpty(editor: any): boolean {
  const { $from } = editor.state.selection
  return $from.parent.textContent.length === 0
}

function isAtStartOfBlock(editor: any): boolean {
  const { $from } = editor.state.selection
  return $from.parentOffset === 0
}

function isAtEndOfBlock(editor: any): boolean {
  const { $from } = editor.state.selection
  return $from.parentOffset === $from.parent.content.size
}

function getNodeTypeName(editor: any): BlockType {
  const { $from } = editor.state.selection
  return $from.parent.type.name as BlockType
}

/**
 * Look backwards through the document for alternating character names
 * to implement A-B-A dialogue auto-insertion.
 * Returns the character name to auto-insert, or null.
 */
function findAlternatingCharacter(editor: any): string | null {
  const { $from } = editor.state.selection
  const doc = editor.state.doc

  // Find the index of the current block at the top level
  const currentIndex = $from.index(0)

  // Walk backwards through top-level nodes collecting character cues
  const recentCharacters: string[] = []

  for (let i = currentIndex; i >= 0 && recentCharacters.length < 2; i--) {
    const node = doc.child(i)
    if (node.type.name === 'characterCue' && node.textContent.trim()) {
      recentCharacters.push(node.textContent.trim())
    }
  }

  // A-B-A pattern: two different characters found, return the earlier one ("A")
  if (recentCharacters.length >= 2 && recentCharacters[0] !== recentCharacters[1]) {
    return recentCharacters[1]
  }

  return null
}

/**
 * Insert a new block of the given type after the current position.
 * Optionally pre-fill with text content.
 */
function insertBlockAfter(editor: any, typeName: BlockType, content?: string) {
  const nodeType = editor.schema.nodes[typeName]
  if (!nodeType) return false

  const textNode = content ? editor.schema.text(content) : null
  const newNode = nodeType.create({ id: generateId() }, textNode ? [textNode] : undefined)

  const { $from } = editor.state.selection
  const endOfBlock = $from.end()

  const cursorPos = endOfBlock + 2 + (content ? content.length : 0)

  editor
    .chain()
    .command(({ tr }: any) => {
      tr.insert(endOfBlock + 1, newNode)
      return true
    })
    .focus(cursorPos)
    .run()

  return true
}

/**
 * Convert the current block to a different type in-place.
 */
function convertBlockTo(editor: any, typeName: BlockType) {
  const nodeType = editor.schema.nodes[typeName]
  if (!nodeType) return false
  return editor.chain().setNode(typeName).run()
}

// ─── Shared keyboard shortcuts for force-type ───
// Cmd+1-6 is stolen by browsers (tab switching), so we use Ctrl+1-6 on Mac
// and also Mod+Shift+1-6 as a fallback that works everywhere.

function forceType(editor: any, targetType: BlockType) {
  // Empty block: convert in place
  if (isBlockEmpty(editor)) {
    return convertBlockTo(editor, targetType)
  }
  // Non-empty block: don't destroy existing text — create new block of target type below
  return insertBlockAfter(editor, targetType)
}

function forceTypeShortcuts() {
  return {
    // Ctrl+number (works on Mac since Cmd+number is browser tabs)
    'Ctrl-1': (props: any) => forceType(props.editor, 'sceneHeading'),
    'Ctrl-2': (props: any) => forceType(props.editor, 'action'),
    'Ctrl-3': (props: any) => forceType(props.editor, 'characterCue'),
    'Ctrl-4': (props: any) => forceType(props.editor, 'parenthetical'),
    'Ctrl-5': (props: any) => forceType(props.editor, 'dialogue'),
    'Ctrl-6': (props: any) => forceType(props.editor, 'transition'),
    // Cmd/Ctrl+Shift+number (universal fallback)
    'Mod-Shift-1': (props: any) => forceType(props.editor, 'sceneHeading'),
    'Mod-Shift-2': (props: any) => forceType(props.editor, 'action'),
    'Mod-Shift-3': (props: any) => forceType(props.editor, 'characterCue'),
    'Mod-Shift-4': (props: any) => forceType(props.editor, 'parenthetical'),
    'Mod-Shift-5': (props: any) => forceType(props.editor, 'dialogue'),
    'Mod-Shift-6': (props: any) => forceType(props.editor, 'transition'),
  }
}

// ─── Enter handler factory ───

function enterHandler(currentType: BlockType) {
  return ({ editor }: any) => {
    if (getNodeTypeName(editor) !== currentType) return false

    // Special: empty action converts to character
    if (currentType === 'action' && isBlockEmpty(editor)) {
      return convertBlockTo(editor, 'characterCue')
    }

    // Dialogue -> action, but check for A-B-A pattern
    if (currentType === 'dialogue' && isAtEndOfBlock(editor)) {
      const altChar = findAlternatingCharacter(editor)
      if (altChar) {
        return insertBlockAfter(editor, 'characterCue', altChar)
      }
      return insertBlockAfter(editor, ENTER_CREATES[currentType])
    }

    const nextType = ENTER_CREATES[currentType]

    // Cursor at end of block (or empty): insert new block after
    if (isAtEndOfBlock(editor) || isBlockEmpty(editor)) {
      return insertBlockAfter(editor, nextType)
    }

    // Cursor in middle of text: split at cursor, convert new block to flow type.
    // splitBlock() splits the node at the cursor position, keeping left half
    // in the original block and right half in a new block of the same type.
    // Then setNode() converts that new block to the correct flow type.
    return editor.chain()
      .splitBlock()
      .setNode(nextType, { id: generateId() })
      .run()
  }
}

// ─── Tab handler factory ───

function tabHandler(currentType: BlockType) {
  return ({ editor }: any) => {
    if (getNodeTypeName(editor) !== currentType) return false
    const targetType = TAB_CYCLE[currentType]
    return convertBlockTo(editor, targetType)
  }
}

function shiftTabHandler(currentType: BlockType) {
  return ({ editor }: any) => {
    if (getNodeTypeName(editor) !== currentType) return false
    const targetType = SHIFT_TAB_CYCLE[currentType]
    return convertBlockTo(editor, targetType)
  }
}

// ─── Backspace handler factory ───

function backspaceHandler(currentType: BlockType) {
  return ({ editor }: any) => {
    if (getNodeTypeName(editor) !== currentType) return false
    if (!isBlockEmpty(editor) || !isAtStartOfBlock(editor)) return false

    const targetType = BACKSPACE_REVERTS[currentType]
    if (targetType === currentType) return false // no-op for action->action
    return convertBlockTo(editor, targetType)
  }
}

// ─── Input Rules ───
// These detect typed patterns and convert the current block's type.

function sceneHeadingInputRules(type: any) {
  return [
    // INT. / EXT. / I/E. / INT./EXT. at start of line
    textblockTypeInputRule({
      find: /^(INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)\s$/i,
      type,
    }),
  ]
}

const TRANSITION_PATTERNS = [
  'CUT TO:',
  'FADE OUT.',
  'FADE IN:',
  'FADE TO:',
  'DISSOLVE TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'WIPE TO:',
  'IRIS OUT.',
]

function transitionInputRules(type: any) {
  // Escape special regex chars and join with |
  const escaped = TRANSITION_PATTERNS.map(p =>
    p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')
  return [
    textblockTypeInputRule({
      find: new RegExp(`^(${escaped})$`, 'i'),
      type,
    }),
  ]
}

function parentheticalInputRules(type: any) {
  // Only convert from dialogue blocks — typing ( in action/scene-heading
  // should NOT hijack the block into a parenthetical.
  return [
    new InputRule({
      find: /^\($/,
      handler: ({ state, range }: any) => {
        const $from = state.doc.resolve(range.from)
        if ($from.parent.type.name !== 'dialogue') return null
        state.tr
          .delete(range.from, range.to)
          .setBlockType(range.from, range.from, type)
      },
    }),
  ]
}

// ─── The 6 Extensions ───

export const SceneHeading = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="scene-heading"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'scene-heading',
      class: 'sp-scene-heading',
    }), 0]
  },

  addInputRules() {
    return sceneHeadingInputRules(this.type)
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('sceneHeading'),
      Tab: tabHandler('sceneHeading'),
      'Shift-Tab': shiftTabHandler('sceneHeading'),
      Backspace: backspaceHandler('sceneHeading'),
      ...forceTypeShortcuts(),
    }
  },
})

export const Action = Node.create({
  name: 'action',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="action"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'action',
      class: 'sp-action',
    }), 0]
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('action'),
      Tab: tabHandler('action'),
      'Shift-Tab': shiftTabHandler('action'),
      Backspace: backspaceHandler('action'),
      ...forceTypeShortcuts(),
    }
  },
})

export const CharacterCue = Node.create({
  name: 'characterCue',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="character"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'character',
      class: 'sp-character',
    }), 0]
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('characterCue'),
      Tab: tabHandler('characterCue'),
      'Shift-Tab': shiftTabHandler('characterCue'),
      Backspace: backspaceHandler('characterCue'),
      ...forceTypeShortcuts(),
    }
  },
})

export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="parenthetical"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'parenthetical',
      class: 'sp-parenthetical',
    }), 0]
  },

  addInputRules() {
    return parentheticalInputRules(this.type)
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('parenthetical'),
      Tab: tabHandler('parenthetical'),
      'Shift-Tab': shiftTabHandler('parenthetical'),
      Backspace: backspaceHandler('parenthetical'),
      ...forceTypeShortcuts(),
    }
  },
})

export const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'dialogue',
      class: 'sp-dialogue',
    }), 0]
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('dialogue'),
      Tab: tabHandler('dialogue'),
      'Shift-Tab': shiftTabHandler('dialogue'),
      Backspace: backspaceHandler('dialogue'),
      ...forceTypeShortcuts(),
    }
  },
})

export const Transition = Node.create({
  name: 'transition',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transition"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'transition',
      class: 'sp-transition',
    }), 0]
  },

  addInputRules() {
    return transitionInputRules(this.type)
  },

  addKeyboardShortcuts() {
    return {
      Enter: enterHandler('transition'),
      Tab: tabHandler('transition'),
      'Shift-Tab': shiftTabHandler('transition'),
      Backspace: backspaceHandler('transition'),
      ...forceTypeShortcuts(),
    }
  },
})

// ─── Dual Dialogue Extension (Cmd+D) ───
// Toggles dual dialogue meta on the current character+dialogue group
// and the adjacent one. For now, dispatches a custom event that the
// component layer handles (since meta lives in metaMapRef).

export const DualDialogueKeymap = Extension.create({
  name: 'dualDialogueKeymap',

  addKeyboardShortcuts() {
    return {
      'Mod-d': ({ editor }) => {
        // Prevent browser bookmark shortcut
        const { $from } = editor.state.selection
        const doc = editor.state.doc
        const currentIndex = $from.index(0)
        const currentNode = doc.child(currentIndex)
        const typeName = currentNode.type.name

        // Only meaningful on character, dialogue, or parenthetical blocks
        const dialogueTypes = new Set(['characterCue', 'dialogue', 'parenthetical'])
        if (!dialogueTypes.has(typeName)) return true // consume the event anyway

        // Walk to find the character cue that owns this dialogue group
        let groupStart = currentIndex
        for (let i = currentIndex; i >= 0; i--) {
          const node = doc.child(i)
          if (node.type.name === 'characterCue') {
            groupStart = i
            break
          }
          if (!dialogueTypes.has(node.type.name)) break
        }

        // Collect block IDs in this dialogue group
        const groupIds: string[] = []
        for (let i = groupStart; i < doc.childCount; i++) {
          const node = doc.child(i)
          if (i > groupStart && node.type.name === 'characterCue') break
          if (!dialogueTypes.has(node.type.name) && i > groupStart) break
          if (dialogueTypes.has(node.type.name)) {
            groupIds.push(node.attrs.id)
          }
        }

        // Dispatch a custom event with the block IDs so the component can toggle meta
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sceneflow:toggle-dual', {
            detail: { blockIds: groupIds },
          }))
        }

        return true
      },
    }
  },
})

// ─── Scene Navigation (Cmd+↑/↓) ───
// Jump cursor between scene headings for fast navigation.

export const SceneNavKeymap = Extension.create({
  name: 'sceneNavKeymap',

  addKeyboardShortcuts() {
    return {
      'Mod-ArrowUp': ({ editor }) => {
        const { $from } = editor.state.selection
        const currentIndex = $from.index(0)
        const doc = editor.state.doc

        // Walk backwards from before current block to find previous scene heading
        for (let i = currentIndex - 1; i >= 0; i--) {
          const node = doc.child(i)
          if (node.type.name === 'sceneHeading') {
            // Calculate position of this node
            let pos = 0
            for (let j = 0; j < i; j++) pos += doc.child(j).nodeSize
            editor.chain().setTextSelection(pos + 1).scrollIntoView().run()
            return true
          }
        }
        return true // consume even if no previous scene
      },

      'Mod-ArrowDown': ({ editor }) => {
        const { $from } = editor.state.selection
        const currentIndex = $from.index(0)
        const doc = editor.state.doc

        // Walk forwards from after current block to find next scene heading
        for (let i = currentIndex + 1; i < doc.childCount; i++) {
          const node = doc.child(i)
          if (node.type.name === 'sceneHeading') {
            let pos = 0
            for (let j = 0; j < i; j++) pos += doc.child(j).nodeSize
            editor.chain().setTextSelection(pos + 1).scrollIntoView().run()
            return true
          }
        }
        return true
      },
    }
  },
})

// ─── Find & Replace Keymap (Cmd+F) ───
// Intercepts Cmd+F and dispatches an event for the component to show the find bar.

export const FindReplaceKeymap = Extension.create({
  name: 'findReplaceKeymap',

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sceneflow:toggle-find'))
        }
        return true
      },
    }
  },
})

// ─── CONT'D Auto-Detection ───
// Adds a data-contd="true" decoration to character cues where the same
// character speaks again after non-dialogue/non-parenthetical blocks.
// CSS ::after then renders the visual "(CONT'D)" suffix.

function stripCharacterAnnotations(name: string): string {
  return name.replace(/\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D)\)\s*/gi, '').trim()
}

export const ContdDetection = Extension.create({
  name: 'contdDetection',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            const doc = state.doc

            let lastCharName: string | null = null
            let hadNonDialogueGap = false

            doc.forEach((node, pos) => {
              const typeName = node.type.name

              if (typeName === 'characterCue') {
                const rawName = node.textContent.trim()
                const cleanName = stripCharacterAnnotations(rawName)

                if (cleanName && lastCharName === cleanName && hadNonDialogueGap) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, { 'data-contd': 'true' })
                  )
                }

                lastCharName = cleanName || null
                hadNonDialogueGap = false
              } else if (typeName === 'dialogue' || typeName === 'parenthetical') {
                // Dialogue/parenthetical blocks don't break continuity
              } else {
                // Any other block type (action, scene heading, transition) creates a gap
                if (lastCharName) {
                  hadNonDialogueGap = true
                }
              }
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})

// ─── Note Keymap (Cmd+M) ───
// Dispatches a custom event with the current block's ID so the component
// can open an inline note editor for that block.

export const NoteKeymap = Extension.create({
  name: 'noteKeymap',

  addKeyboardShortcuts() {
    return {
      'Mod-m': ({ editor }) => {
        const { $from } = editor.state.selection
        const blockId = $from.parent.attrs?.id
        if (blockId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sceneflow:toggle-note', {
            detail: { blockId },
          }))
        }
        return true
      },
    }
  },
})

// ─── Convenience array of all extensions ───

export const screenplayExtensions = [
  SceneHeading,
  Action,
  CharacterCue,
  Parenthetical,
  Dialogue,
  Transition,
]
