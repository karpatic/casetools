#!/bin/bash

# Output directory
OUTPUT_DIR="./letters"

# Ensure the output directory exists
if [ ! -d "$OUTPUT_DIR" ]; then
  mkdir -p "$OUTPUT_DIR"
fi

# Function to generate a single letter PDF
generate_pdf() {
  local letter=$1
  local tex_file="$OUTPUT_DIR/$letter.tex"
  local pdf_file="$OUTPUT_DIR/$letter.pdf"

  # Create LaTeX file
  cat << EOF > "$tex_file"
\documentclass[letterpaper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\usepackage{graphicx}
\renewcommand{\familydefault}{\sfdefault} % Use sans-serif font
\geometry{margin=1in}
\pagestyle{empty} % No page numbers

\begin{document}

\vspace*{\fill}
\begin{center}
    \scalebox{30}{\textbf{$letter}} % Scale the letter 30 times larger
\end{center}
\vspace*{\fill}

\end{document}
EOF

  # Generate PDF
  pdflatex -output-directory "$OUTPUT_DIR" "$tex_file" > /dev/null 2>&1

  # Remove the LaTeX and intermediate files
  rm "$tex_file"
  rm "$OUTPUT_DIR/$letter.aux" "$OUTPUT_DIR/$letter.log"

  echo "Generated $pdf_file"
}

# Generate PDFs for single letters A-Z
for letter in {A..Z}; do
  generate_pdf "$letter"
done

# Generate PDFs for double letters AA, BB, ..., ZZ
for letter in {A..Z}; do
  generate_pdf "$letter$letter"
done

# Generate PDFs for triple letters AAA, BBB, ..., ZZZ
for letter in {A..Z}; do
  generate_pdf "$letter$letter$letter"
done

# Generate PDFs for quadruple letters AAAA, BBBB, ..., ZZZZ
for letter in {A..Z}; do
  generate_pdf "$letter$letter$letter$letter"
done

echo "All PDFs generated in $OUTPUT_DIR"