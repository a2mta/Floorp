import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { editorConfig } from "./config.ts";
import { Toolbar } from "./Toolbar.tsx";

import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { SerializedEditorState, SerializedLexicalNode } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode } from "lexical";
import { useEffect, useRef, memo } from "react";
import { useTranslation } from "react-i18next";

interface RichTextEditorProps {
    onChange: (editorState: SerializedEditorState<SerializedLexicalNode>) => void;
    initialContent?: string;
}

// React.memo: only re-render (remount) when key changes (note switch).
// onChange is stable (useCallback with [] deps in parent).
// initialContent changes on every edit but is only used on mount — ignore it.
export const RichTextEditor = memo(
    ({ onChange, initialContent }: RichTextEditorProps) => {
        return (
            <LexicalComposer initialConfig={editorConfig}>
                <EditorContent onChange={onChange} initialContent={initialContent} />
            </LexicalComposer>
        );
    },
    (prev, next) => prev.onChange === next.onChange,
);

// React.memo with () => true: never re-render during editing.
// All editor state is managed internally by Lexical, not React props.
const EditorContent = memo(
    ({ onChange, initialContent }: RichTextEditorProps) => {
        const [editor] = useLexicalComposerContext();
        const { t } = useTranslation();
        const skipNextChange = useRef(true);

        // Set initial content on mount only
        useEffect(() => {
            skipNextChange.current = true;

            if (initialContent) {
                try {
                    const parsedContent = JSON.parse(initialContent);
                    editor.setEditorState(editor.parseEditorState(parsedContent));
                } catch {
                    editor.update(() => {
                        const root = $getRoot();
                        root.clear();

                        const lines = initialContent.split("\n");

                        for (const line of lines) {
                            const paragraphNode = $createParagraphNode();
                            if (line.length > 0) {
                                paragraphNode.append($createTextNode(line));
                            }
                            root.append(paragraphNode);
                        }
                    });
                }
            } else {
                skipNextChange.current = false;
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Listen for content changes only (not selection changes)
        useEffect(() => {
            return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
                const isDirty = dirtyElements.size > 0 || dirtyLeaves.size > 0;
                if (!isDirty) return;

                if (skipNextChange.current) {
                    skipNextChange.current = false;
                    return;
                }

                editorState.read(() => {
                    onChange(editorState.toJSON());
                });
            });
        }, [editor, onChange]);

        return (
            <div className="flex flex-col h-full">
                <Toolbar />
                <div className="flex-1 overflow-auto p-2">
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable
                                className="h-full outline-none"
                                aria-label={t("editor.contentArea")}
                                aria-multiline={true}
                                spellCheck={false}
                            />
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                </div>
                <ListPlugin />
                <CheckListPlugin />
                <HistoryPlugin />
            </div>
        );
    },
    () => true, // Never re-render — all updates are handled via Lexical's internal state
);
