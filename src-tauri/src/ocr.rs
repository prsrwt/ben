// Text recognition (OCR) with the engine built into Windows (Windows.Media.Ocr): no download, no model, works
// offline. Used for pages that are pictures: scanned newspapers (rendered to an image by PDF.js first) and photos
// of notes in the Library. Gives every word with its box, in the image's own pixels, so the newspaper layout can
// read columns and headlines from a scan the same way it does from a PDF with real text.

use serde::Serialize;

#[derive(Serialize)]
pub struct OcrWord {
    text: String,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

#[derive(Serialize)]
pub struct OcrLine {
    words: Vec<OcrWord>,
}

#[derive(Serialize)]
pub struct OcrPage {
    /// The image's size in pixels; word boxes are in the same pixels.
    width: u32,
    height: u32,
    lines: Vec<OcrLine>,
    /// The language read in, e.g. "en-US".
    language: String,
}

#[cfg(windows)]
mod engine {
    use super::{OcrLine, OcrPage, OcrWord};
    use windows::Graphics::Imaging::{
        BitmapAlphaMode, BitmapDecoder, BitmapInterpolationMode, BitmapPixelFormat, BitmapTransform, ColorManagementMode,
        ExifOrientationMode,
    };
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

    /// What the student sees when Windows has no text recognition for any of their languages.
    const NO_LANGUAGE: &str = "Windows can't read text in your language yet. Add English (or your language) in Settings › Time & language › Language & region, then try again.";

    pub fn recognize(image: &[u8], language: Option<&str>) -> windows::core::Result<Result<OcrPage, String>> {
        let engine = if let Some(tag) = language {
            // A language asked for (a Hindi paper): that one, or a plain answer that Windows can't read it here.
            let wanted = windows::Globalization::Language::CreateLanguage(&tag.into())?;
            if !OcrEngine::IsLanguageSupported(&wanted)? {
                let name = wanted.DisplayName().map(|n| n.to_string()).unwrap_or_else(|_| tag.to_string());
                return Ok(Err(format!(
                    "Windows can't read {name} from pictures on this PC, so Ben can't read this paper's pages. Open it from the Library to see the PDF."
                )));
            }
            match OcrEngine::TryCreateFromLanguage(&wanted) {
                Ok(engine) => engine,
                Err(_) => return Ok(Err(NO_LANGUAGE.into())),
            }
        } else {
            // The student's own languages first (Windows Settings); English if none of them can be read.
            match OcrEngine::TryCreateFromUserProfileLanguages() {
                Ok(engine) => engine,
                Err(_) => {
                    let english = windows::Globalization::Language::CreateLanguage(&"en-US".into())?;
                    match OcrEngine::TryCreateFromLanguage(&english) {
                        Ok(engine) => engine,
                        Err(_) => return Ok(Err(NO_LANGUAGE.into())),
                    }
                }
            }
        };

        // The image bytes (PNG, JPEG…) into a stream Windows can decode.
        let stream = InMemoryRandomAccessStream::new()?;
        let writer = DataWriter::CreateDataWriter(&stream)?;
        writer.WriteBytes(image)?;
        writer.StoreAsync()?.join()?;
        writer.FlushAsync()?.join()?;
        writer.DetachStream()?;
        stream.Seek(0)?;
        let decoder = match BitmapDecoder::CreateAsync(&stream)?.join() {
            Ok(decoder) => decoder,
            Err(_) => return Ok(Err("This picture couldn't be opened.".into())),
        };

        // The engine has a size limit (about 10,000 pixels a side): larger images are scaled down to fit, and the
        // word boxes scaled back up, so they're always in the original image's pixels. Photos are turned upright
        // as their camera recorded.
        let (width, height) = (decoder.OrientedPixelWidth()?, decoder.OrientedPixelHeight()?);
        let limit = OcrEngine::MaxImageDimension()?;
        let scale = (limit as f32 / width.max(height) as f32).min(1.0);
        let transform = BitmapTransform::new()?;
        if scale < 1.0 {
            transform.SetScaledWidth(((width as f32 * scale) as u32).max(1))?;
            transform.SetScaledHeight(((height as f32 * scale) as u32).max(1))?;
            transform.SetInterpolationMode(BitmapInterpolationMode::Fant)?;
        }
        let bitmap = decoder
            .GetSoftwareBitmapTransformedAsync(
                BitmapPixelFormat::Bgra8,
                BitmapAlphaMode::Premultiplied,
                &transform,
                ExifOrientationMode::RespectExifOrientation,
                ColorManagementMode::DoNotColorManage,
            )?
            .join()?;

        let result = engine.RecognizeAsync(&bitmap)?.join()?;
        let mut lines = Vec::new();
        for line in result.Lines()? {
            let mut words = Vec::new();
            for word in line.Words()? {
                let rect = word.BoundingRect()?;
                words.push(OcrWord {
                    text: word.Text()?.to_string(),
                    x: rect.X / scale,
                    y: rect.Y / scale,
                    width: rect.Width / scale,
                    height: rect.Height / scale,
                });
            }
            if !words.is_empty() {
                lines.push(OcrLine { words });
            }
        }
        let language = engine.RecognizerLanguage()?.LanguageTag()?.to_string();
        Ok(Ok(OcrPage { width, height, lines, language }))
    }
}

/// Reads the text in an image. Slow work (a large scan takes a second or two), so it runs off the main thread.
#[cfg(windows)]
fn recognize(image: Vec<u8>, language: Option<String>) -> Result<OcrPage, String> {
    engine::recognize(&image, language.as_deref()).unwrap_or_else(|e| Err(format!("Windows couldn't read the text ({}).", e.message())))
}

#[cfg(not(windows))]
fn recognize(_image: Vec<u8>, _language: Option<String>) -> Result<OcrPage, String> {
    Err("Reading text from pictures needs Windows.".into())
}

// --- Commands -------------------------------------------------------------------------------------------------

/// The text in an image sent as raw bytes (a scanned newspaper page rendered by PDF.js). An "Ocr-Language" header
/// ("hi") asks for that language rather than the student's own.
#[tauri::command]
pub async fn ocr_image(request: tauri::ipc::Request<'_>) -> Result<OcrPage, String> {
    let tauri::ipc::InvokeBody::Raw(image) = request.body() else {
        return Err("expected the image's bytes".into());
    };
    let image = image.clone();
    let language = request.headers().get("ocr-language").and_then(|v| v.to_str().ok()).map(str::to_string);
    tauri::async_runtime::spawn_blocking(move || recognize(image, language)).await.map_err(|e| e.to_string())?
}

/// The text in a picture file, which must be inside one of the Library's folders (a photo of notes).
#[tauri::command]
pub async fn ocr_file(state: tauri::State<'_, crate::library::LibraryState>, path: String) -> Result<OcrPage, String> {
    if !state.allows(std::path::Path::new(&path)) {
        return Err("not in a Library folder".into());
    }
    let image = std::fs::read(&path).map_err(|_| "This picture couldn't be opened.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || recognize(image, None)).await.map_err(|e| e.to_string())?
}
