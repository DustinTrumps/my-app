import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";

interface PhotoData {
  data_url: string;
  metadata: Record<string, unknown>;
}

const KNOWN_KEYS = [
  "File Name", "Image Width", "Image Height", "Format",
  "Color Type", "Bits Per Pixel", "Pixel Count", "File Size",
];

function App() {
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPhoto() {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff"],
        }],
      });
      if (!selected) return;
      setLoading(true);
      const data = await invoke<PhotoData>("read_photo", { path: selected });
      setPhoto(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getAllMetadata(): Record<string, unknown> {
    if (!photo) return {};
    const merged = { ...photo.metadata };
    return merged;
  }

  async function exportJson() {
    if (!photo) return;
    try {
      const filePath = await save({
        defaultPath: `${photo.metadata["File Name"] || "photo"}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, JSON.stringify(getAllMetadata(), null, 2));
    } catch (e) {
      setError(String(e));
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function knownLabel(key: string): string {
    return {
      "Image Width": "Width",
      "Image Height": "Height",
      "Bits Per Pixel": "Bit Depth",
      "Pixel Count": "Pixels",
      "File Size": "File Size",
      "Format": "Format",
      "Color Type": "Color Type",
      "File Name": "File Name",
    }[key] || key;
  }

  function knownValue(key: string, value: unknown): string {
    switch (key) {
      case "File Size": return formatSize(value as number);
      case "Bits Per Pixel": return `${value} bpp`;
      case "Pixel Count": return (value as number).toLocaleString();
      case "Image Width": return `${value} px`;
      case "Image Height": return `${value} px`;
      default: return String(value);
    }
  }

  const m = photo?.metadata;
  const extraEntries = m ? Object.entries(m).filter(([k]) => !KNOWN_KEYS.includes(k)) : [];

  return (
    <main className="container">
      <h1>Photo Viewer</h1>
      <button onClick={openPhoto} disabled={loading}>
        {loading ? "Loading..." : "Open Photo"}
      </button>
      {error && <p className="error">{error}</p>}
      {photo && (
        <div className="photo-viewer">
          <div className="photo-container">
            <img src={photo.data_url} alt="Photo" />
          </div>
          <div className="photo-info">
            <h2>{String(m!["File Name"] || "Photo")}</h2>

            <h3 className="section-title">Properties</h3>
            <table>
              <tbody>
                {KNOWN_KEYS.filter(k => k !== "File Name" && m![k] !== undefined).map(key => (
                  <tr key={key}>
                    <td className="key-cell">{knownLabel(key)}</td>
                    <td>{knownValue(key, m![key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {extraEntries.length > 0 && (
              <>
                <h3 className="section-title">Extra Metadata</h3>
                <table>
                  <tbody>
                    {extraEntries.map(([key, value]) => (
                      <tr key={key}>
                        <td className="key-cell">{key}</td>
                        <td>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <button className="export-btn" onClick={exportJson}>Export JSON</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
