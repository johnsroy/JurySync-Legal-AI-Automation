import sys
import json
import base64
import io
from PyPDF2 import PdfReader
import pytesseract
from pdf2image import convert_from_bytes

def process_pdf(pdf_bytes):
    try:
        # First try normal text extraction
        pdf = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        page_count = len(pdf.pages)
        
        for page in pdf.pages:
            try:
                text += page.extract_text() + "\n"
            except Exception as e:
                print(f"Error extracting text from page: {str(e)}", file=sys.stderr)
                
        # If no text was extracted, try OCR
        if not text.strip():
            images = convert_from_bytes(pdf_bytes)
            for image in images:
                try:
                    text += pytesseract.image_to_string(image) + "\n"
                except Exception as e:
                    print(f"OCR error: {str(e)}", file=sys.stderr)
                    
        return {
            "success": True,
            "text": text.strip(),
            "pageCount": page_count
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "No input provided"}))
        sys.exit(1)
        
    try:
        pdf_bytes = base64.b64decode(sys.argv[1])
        result = process_pdf(pdf_bytes)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Processing failed: {str(e)}"
        }))
