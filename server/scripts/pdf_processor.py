import sys
import json
import base64
import io
import traceback
from PyPDF2 import PdfReader
import pytesseract
from pdf2image import convert_from_bytes

def log_error(message, error=None):
    error_info = {
        'message': message,
        'error': str(error) if error else None,
        'traceback': traceback.format_exc() if error else None
    }
    print(f"Error: {json.dumps(error_info)}", file=sys.stderr)

def process_pdf(pdf_bytes):
    try:
        # First try normal text extraction
        pdf = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        page_count = len(pdf.pages)

        print(f"Processing PDF with {page_count} pages", file=sys.stderr)

        for page_num, page in enumerate(pdf.pages, 1):
            try:
                page_text = page.extract_text()
                if page_text.strip():
                    text += page_text + "\n"
                else:
                    print(f"No text extracted from page {page_num}, will try OCR", file=sys.stderr)
            except Exception as e:
                log_error(f"Error extracting text from page {page_num}", e)

        # If no text was extracted or text is too short, try OCR
        if not text.strip() or len(text.split()) < 50:
            print("Insufficient text extracted, attempting OCR", file=sys.stderr)
            try:
                images = convert_from_bytes(pdf_bytes)
                ocr_text = ""
                for i, image in enumerate(images, 1):
                    try:
                        page_text = pytesseract.image_to_string(image)
                        if page_text.strip():
                            ocr_text += page_text + "\n"
                        print(f"OCR completed for page {i}", file=sys.stderr)
                    except Exception as e:
                        log_error(f"OCR error on page {i}", e)

                if ocr_text.strip():
                    text = ocr_text
                    print("Successfully extracted text using OCR", file=sys.stderr)
            except Exception as e:
                log_error("OCR processing failed", e)
                if not text.strip():
                    raise Exception("Both text extraction and OCR failed")

        return {
            "success": True,
            "text": text.strip(),
            "pageCount": page_count
        }

    except Exception as e:
        log_error("PDF processing failed", e)
        return {
            "success": False,
            "error": str(e),
            "pageCount": 0
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "No input provided"
        }))
        sys.exit(1)

    try:
        pdf_bytes = base64.b64decode(sys.argv[1])
        result = process_pdf(pdf_bytes)
        print(json.dumps(result))
    except Exception as e:
        log_error("Main process failed", e)
        print(json.dumps({
            "success": False,
            "error": f"Processing failed: {str(e)}"
        }))