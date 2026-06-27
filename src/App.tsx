import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";

function App() {
  const [photo, setPhoto] = useState<Record<string, any> | null>(null);
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
      const data = await invoke<{ data_url: string; metadata: Record<string, any> }>("read_photo", { path: selected });
      setPhoto({ data_url: data.data_url, ...data.metadata });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function getAllMetadata(): Record<string, any> {
    if (!photo) return {};
    const merged: Record<string, any> = {};
    for (const [key, value] of Object.entries(photo)) {
      if (key !== "data_url") merged[key] = value;
    }
    return merged;
  }

  async function exportJson() {
    if (!photo) return;
    try {
      const filePath = await save({
        defaultPath: `${photo["File Name"] || "photo"}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, JSON.stringify(getAllMetadata(), null, 2));
    } catch (e) {
      setError(String(e));
    }
  }

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
            <h2>{photo["File Name"] || "Photo"}</h2>

            <h3 className="section-title">Metadata</h3>
            <table>
              <tbody>
                <tr>
                  <td>Camera</td>
                  <td>{[photo.Make, photo.Model].filter(Boolean).join(" ")}</td>
                </tr>
                <tr>
                  <td>Date Taken</td>
                  <td>{photo["DateTimeOriginal"]?.replace(/:/g, (_m: string, i: number) => (i < 10 ? "-" : ":"))}</td>
                </tr>
                <tr>
                  <td>Dimensions</td>
                  <td>{photo["Image Width"]} x {photo["Image Height"]}</td>
                </tr>
              </tbody>
            </table>
            <button className="export-btn" onClick={exportJson}>Export JSON</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;