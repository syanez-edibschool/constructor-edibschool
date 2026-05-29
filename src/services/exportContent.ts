// Exportación de contenido a PDF y Word con imports dinámicos
// (las librerías solo se cargan cuando el usuario realmente exporta)

export function exportToPDF(title: string, content: string) {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(title, 20, 20)
    doc.setFontSize(12)
    const lines = doc.splitTextToSize(content, 170)
    doc.text(lines, 20, 35)
    doc.save(title.toLowerCase().replace(/ /g, '-') + '.pdf')
  })
}

export function exportToWord(title: string, content: string) {
  import('docx').then(({ Document, Paragraph, TextRun, Packer }) => {
    import('file-saver').then(({ saveAs }) => {
      const paragraphs = content.split('\n').map(
        (line) =>
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                bold: line.startsWith('##'),
                size: line.startsWith('##') ? 28 : 24,
              }),
            ],
          })
      )
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] })
      Packer.toBlob(doc).then((blob) => saveAs(blob, title + '.docx'))
    })
  })
}
