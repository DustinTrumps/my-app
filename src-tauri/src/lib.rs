use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct PhotoData {
    data_url: String,
    metadata: HashMap<String, Value>,
}

#[tauri::command]
fn read_photo(path: String) -> Result<PhotoData, String> {
    let file_path = Path::new(&path);

    let bytes = fs::read(file_path).map_err(|e| e.to_string())?;
    let file_size = bytes.len() as u64;

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let reader = image::io::Reader::open(file_path).map_err(|e| e.to_string())?;
    let reader = reader.with_guessed_format().map_err(|e| e.to_string())?;
    let format = reader.format();
    let (width, height) = reader.into_dimensions().map_err(|e| e.to_string())?;

    let format_name = match format {
        Some(f) => format!("{:?}", f),
        None => "Unknown".to_string(),
    };

    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let color_type = format!("{:?}", img.color());
    let bits_per_pixel = img.color().bits_per_pixel();

    let mime = match format {
        Some(image::ImageFormat::Png) => "image/png",
        Some(image::ImageFormat::Jpeg) => "image/jpeg",
        Some(image::ImageFormat::Gif) => "image/gif",
        Some(image::ImageFormat::WebP) => "image/webp",
        Some(image::ImageFormat::Bmp) => "image/bmp",
        Some(image::ImageFormat::Tiff) => "image/tiff",
        _ => "application/octet-stream",
    };

    let mut metadata: HashMap<String, Value> = HashMap::new();
    metadata.insert("File Name".into(), json!(filename));
    metadata.insert("File Size".into(), json!(file_size));
    metadata.insert("Image Width".into(), json!(width));
    metadata.insert("Image Height".into(), json!(height));
    metadata.insert("Format".into(), json!(format_name));
    metadata.insert("Color Type".into(), json!(color_type));
    metadata.insert("Bits Per Pixel".into(), json!(bits_per_pixel));
    metadata.insert("Pixel Count".into(), json!(width as u64 * height as u64));

    if mime == "image/jpeg" || mime == "image/tiff" {
        if let Ok(exif) = exif::Reader::new().read_from_container(&mut std::io::Cursor::new(&bytes)) {
            for field in exif.fields() {
                let name = field.tag.to_string();
                let value = field.display_value().to_string().trim_matches('"').to_string();
                metadata.insert(name, json!(value));
            }
        }
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, b64);

    Ok(PhotoData { data_url, metadata })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![read_photo])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
