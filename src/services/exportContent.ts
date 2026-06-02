// Exportación de contenido a PDF y Word con imports dinámicos
// (las librerías solo se cargan cuando el usuario realmente exporta)

export function exportToPDF(title: string, content: string) {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 20
    const marginTop = 20
    const marginBottom = 20
    const lineHeight = 7

    // Título
    doc.setFontSize(18)
    doc.text(doc.splitTextToSize(title, 170), marginX, marginTop)

    // Cuerpo: paginar manualmente para NO perder contenido que pase de la página 1
    doc.setFontSize(12)
    const lines: string[] = doc.splitTextToSize(content, 170)
    let y = marginTop + 15
    for (const line of lines) {
      if (y > pageHeight - marginBottom) {
        doc.addPage()
        y = marginTop
      }
      doc.text(line, marginX, y)
      y += lineHeight
    }

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
