"use client";

import { useState } from "react";
import styles from "./page.module.css";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className={styles.copyButton} onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
