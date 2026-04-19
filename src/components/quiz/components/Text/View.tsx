"use client";

import React, { useRef, useEffect } from "react";
import { type TextAlign, resolveTextFontSize } from "./types";

export interface TextViewProps {
  text: string;
  fontSize?: number;
  align?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  isEditing?: boolean;
  onTextChange?: (text: string) => void;
}

const alignClass: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TextView({
  text,
  fontSize,
  align = "center",
  bold = false,
  italic = false,
  underline = false,
  color,
  isEditing = false,
  onTextChange,
}: TextViewProps) {
  const resolvedFontSize = resolveTextFontSize(fontSize);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const baseClasses = [
    "flex",
    "flex-col",
    "justify-center",
    "h-full",
    "w-full",
    "my-1",
    alignClass[align],
    bold ? "font-bold" : "font-normal",
    italic ? "italic" : "not-italic",
    underline ? "underline" : "no-underline",
    color ? "" : "text-white",
    "max-w-full",
    "break-words",
    "whitespace-pre-wrap",
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties = {
    fontSize: `${resolvedFontSize}px`,
    lineHeight: resolvedFontSize <= 14 ? 1.5 : resolvedFontSize >= 28 ? 1.2 : 1.35,
  };
  if (color && typeof color === "string") {
    style.color = color;
  }

  if (isEditing && onTextChange) {
    return (
      <div className={baseClasses} style={style}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="w-full resize-none bg-transparent outline-none border-none p-0 m-0"
          rows={Math.max(1, text.split('\n').length)}
          style={{
            fontSize: `${resolvedFontSize}px`,
            lineHeight: style.lineHeight,
            color: style.color,
            fontWeight: bold ? "bold" : "normal",
            fontStyle: italic ? "italic" : "normal",
            textDecoration: underline ? "underline" : "none",
            textAlign: align,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div className={baseClasses} style={style}>
      {text}
    </div>
  );
}

export default TextView;
