{pkgs}: {
  deps = [
    pkgs.ghostscript
    pkgs.tesseract
    pkgs.poppler_utils
    pkgs.postgresql
  ];
}
