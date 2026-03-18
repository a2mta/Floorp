import { useCallback, useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    $createParagraphNode,
    $isElementNode,
    UNDO_COMMAND,
    REDO_COMMAND,
    CAN_UNDO_COMMAND,
    CAN_REDO_COMMAND,
    COMMAND_PRIORITY_LOW,
} from "lexical";
import {
    $createHeadingNode,
    $isHeadingNode,
    type HeadingTagType,
} from "@lexical/rich-text";
import {
    $isListNode,
    INSERT_UNORDERED_LIST_COMMAND,
    INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import { $setBlocksType } from "@lexical/selection";
import { useTranslation } from "react-i18next";
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Heading1,
    Heading2,
    Heading3,
    Undo2,
    Redo2,
} from "lucide-react";

/**
 * Toolbar that uses direct DOM manipulation instead of React state
 * to avoid re-renders that disrupt Firefox's focus management.
 */
export const Toolbar = () => {
    const { t } = useTranslation();
    const [editor] = useLexicalComposerContext();
    const toolbarRef = useRef<HTMLDivElement>(null);

    // All state updates go through direct DOM manipulation — no useState, no re-renders.
    useEffect(() => {
        const toolbar = toolbarRef.current;
        if (!toolbar) return;

        const updateButton = (selector: string, active: boolean) => {
            const btn = toolbar.querySelector(selector) as HTMLElement | null;
            if (!btn) return;
            btn.classList.toggle("btn-active", active);
            btn.classList.toggle("btn-ghost", !active);
            btn.setAttribute("aria-pressed", String(active));
        };

        const clearAll = () => {
            for (const btn of toolbar.querySelectorAll("[data-format]")) {
                btn.classList.remove("btn-active");
                btn.classList.add("btn-ghost");
                btn.setAttribute("aria-pressed", "false");
            }
        };

        const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    clearAll();
                    return;
                }

                // Text formats
                updateButton('[data-format="bold"]', selection.hasFormat("bold"));
                updateButton('[data-format="italic"]', selection.hasFormat("italic"));
                updateButton('[data-format="underline"]', selection.hasFormat("underline"));
                updateButton('[data-format="strikethrough"]', selection.hasFormat("strikethrough"));

                // Block-level info
                const anchorNode = selection.anchor.getNode();
                const element =
                    anchorNode.getKey() === "root"
                        ? anchorNode
                        : anchorNode.getTopLevelElementOrThrow();

                const listType = $isListNode(element) ? element.getListType() : null;
                updateButton('[data-format="bullet"]', listType === "bullet");
                updateButton('[data-format="number"]', listType === "number");

                const headingType = $isHeadingNode(element) ? element.getTag() : null;
                updateButton('[data-format="h1"]', headingType === "h1");
                updateButton('[data-format="h2"]', headingType === "h2");
                updateButton('[data-format="h3"]', headingType === "h3");

                const align = $isElementNode(element) ? element.getFormatType() : null;
                updateButton('[data-format="left"]', align === "left");
                updateButton('[data-format="center"]', align === "center");
                updateButton('[data-format="right"]', align === "right");
            });
        });

        const unregisterUndo = editor.registerCommand(
            CAN_UNDO_COMMAND,
            (payload: boolean) => {
                const btn = toolbar.querySelector('[data-action="undo"]') as HTMLButtonElement | null;
                if (btn) btn.disabled = !payload;
                return false;
            },
            COMMAND_PRIORITY_LOW,
        );
        const unregisterRedo = editor.registerCommand(
            CAN_REDO_COMMAND,
            (payload: boolean) => {
                const btn = toolbar.querySelector('[data-action="redo"]') as HTMLButtonElement | null;
                if (btn) btn.disabled = !payload;
                return false;
            },
            COMMAND_PRIORITY_LOW,
        );

        return () => {
            unregisterUpdate();
            unregisterUndo();
            unregisterRedo();
        };
    }, [editor]);

    const formatText = useCallback(
        (command: "bold" | "italic" | "underline" | "strikethrough") => {
            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;

                if (command === "underline") {
                    if (selection.hasFormat("strikethrough")) {
                        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
                    }
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
                } else if (command === "strikethrough") {
                    if (selection.hasFormat("underline")) {
                        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
                    }
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
                } else {
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, command);
                }
            });
        },
        [editor],
    );

    const formatElement = useCallback(
        (command: "left" | "center" | "right") => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, command);
                }
            });
        },
        [editor],
    );

    const formatHeading = useCallback(
        (type: HeadingTagType) => {
            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;

                const element = selection.anchor.getNode().getTopLevelElementOrThrow();
                const isHeading = $isHeadingNode(element);
                const currentType = isHeading ? element.getTag() : null;

                if (isHeading && currentType === type) {
                    $setBlocksType(selection, () => $createParagraphNode());
                } else {
                    $setBlocksType(selection, () => $createHeadingNode(type));
                }
            });
        },
        [editor],
    );

    const toggleUnOrderList = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const element = selection.anchor.getNode().getTopLevelElementOrThrow();
            if ($isListNode(element) && element.getListType() === "bullet") {
                $setBlocksType(selection, () => $createParagraphNode());
            } else {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            }
        });
    }, [editor]);

    const toggleOrderList = useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const element = selection.anchor.getNode().getTopLevelElementOrThrow();
            if ($isListNode(element) && element.getListType() === "number") {
                $setBlocksType(selection, () => $createParagraphNode());
            } else {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            }
        });
    }, [editor]);

    return (
        <>
            {/* onMouseDown preventDefault keeps focus in the editor when clicking toolbar buttons */}
            <div
                ref={toolbarRef}
                className="flex flex-wrap gap-0.5 p-1"
                role="toolbar"
                aria-label={t("editor.toolbar")}
                onMouseDown={(e) => e.preventDefault()}
            >
                <div className="flex flex-wrap gap-0.5" role="group" aria-label={t("editor.history")}>
                    <button
                        type="button"
                        data-action="undo"
                        className="btn btn-xs btn-ghost"
                        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
                        disabled
                        aria-label={t("editor.undo")}
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-action="redo"
                        className="btn btn-xs btn-ghost"
                        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
                        disabled
                        aria-label={t("editor.redo")}
                    >
                        <Redo2 className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0" />
                <div className="flex flex-wrap gap-0.5" role="group" aria-label={t("editor.headings")}>
                    <button
                        type="button"
                        data-format="h1"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatHeading("h1")}
                        aria-label={t("editor.heading1")}
                        aria-pressed="false"
                    >
                        <Heading1 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="h2"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatHeading("h2")}
                        aria-label={t("editor.heading2")}
                        aria-pressed="false"
                    >
                        <Heading2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="h3"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatHeading("h3")}
                        aria-label={t("editor.heading3")}
                        aria-pressed="false"
                    >
                        <Heading3 className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0" />
                <div className="flex flex-wrap gap-0.5" role="group" aria-label={t("editor.textFormatting")}>
                    <button
                        type="button"
                        data-format="bold"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatText("bold")}
                        aria-label={t("editor.bold")}
                        aria-pressed="false"
                    >
                        <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="italic"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatText("italic")}
                        aria-label={t("editor.italic")}
                        aria-pressed="false"
                    >
                        <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="underline"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatText("underline")}
                        aria-label={t("editor.underline")}
                        aria-pressed="false"
                    >
                        <Underline className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="strikethrough"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatText("strikethrough")}
                        aria-label={t("editor.strikethrough")}
                        aria-pressed="false"
                    >
                        <Strikethrough className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0" />
                <div className="flex flex-wrap gap-0.5" role="group" aria-label={t("editor.lists")}>
                    <button
                        type="button"
                        data-format="bullet"
                        className="btn btn-xs btn-ghost"
                        onClick={toggleUnOrderList}
                        aria-label={t("editor.bulletList")}
                        aria-pressed="false"
                    >
                        <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="number"
                        className="btn btn-xs btn-ghost"
                        onClick={toggleOrderList}
                        aria-label={t("editor.numberedList")}
                        aria-pressed="false"
                    >
                        <ListOrdered className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0" />
                <div className="flex flex-wrap gap-0.5" role="group" aria-label={t("editor.alignment")}>
                    <button
                        type="button"
                        data-format="left"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatElement("left")}
                        aria-label={t("editor.alignLeft")}
                        aria-pressed="false"
                    >
                        <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="center"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatElement("center")}
                        aria-label={t("editor.alignCenter")}
                        aria-pressed="false"
                    >
                        <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        data-format="right"
                        className="btn btn-xs btn-ghost"
                        onClick={() => formatElement("right")}
                        aria-label={t("editor.alignRight")}
                        aria-pressed="false"
                    >
                        <AlignRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            <div className="divider my-0" />
        </>
    );
};
