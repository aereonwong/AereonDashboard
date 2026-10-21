// Prints the text of a PDF (macOS PDFKit — already on this Mac, nothing to install). Used by scripts/expense-scan.mjs.
import Foundation
import PDFKit

guard CommandLine.arguments.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write("cannot open PDF\n".data(using: .utf8)!)
    exit(1)
}
print(doc.string ?? "")
