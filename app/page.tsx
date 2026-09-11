import { headers } from "next/headers";
import { CopyButton } from "./copy-button";
import styles from "./page.module.css";

export default async function Home() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const agentPrompt = `Upload a file using ${origin}. Follow ${origin}/openapi.json and pay HTTP 402s.`;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Bounded file drop</h1>
          <p>
            Nothing is stored until size, retention, and transfer are purchased.
            Paid bytes go to Amazon S3. Limits are hard. Overages return a
            renewal 402, never a surprise charge.
          </p>
          <p>
            <code className={styles.code}>$0.01</code> · 3 MB · 24h · 50 MB
            transfer
            <br />
            <code className={styles.code}>$0.05</code> · 3 MB · 7 days · 1 GB
            transfer · 100 downloads
          </p>
          <p>
            Agents:{" "}
            <a href="/openapi.json">/openapi.json</a>
            {" · "}
            <a href="/llms.txt">/llms.txt</a>
            {" · "}
            <a href="/api/packages">/api/packages</a>
          </p>
          <div className={styles.terminal} aria-label="Example agent prompt">
            <div className={styles.terminalBar}>
              <span className={styles.terminalDots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className={styles.terminalTitle}>example-agent-prompt</span>
              <CopyButton text={agentPrompt} />
            </div>
            <pre className={styles.terminalBody}>
              <span className={styles.terminalPrompt}>agent@drop ~ %</span>
              {" cat <<'PROMPT'\n"}
              {agentPrompt}
              {"\nPROMPT"}
            </pre>
          </div>
          <pre className={styles.codeBlock}>
            {`# 1. Buy an envelope (Tempo testnet)
npx mppx --network testnet -X POST -J '{
  "filename": "report.pdf",
  "size_bytes": 12000,
  "retention": "7d"
}' ${origin}/api/files

# 2. PUT the file to upload.url with Content-Length = size_bytes
# 3. Publish
curl -X POST ${origin}/api/files/<id>/complete

# 4. Download until a limit is hit (410 or 402 renew)
curl -OJ ${origin}/f/<id>`}
          </pre>
        </div>
      </main>
    </div>
  );
}
