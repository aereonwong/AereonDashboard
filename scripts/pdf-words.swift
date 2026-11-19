// Prints every text line of a PDF with its position: page<TAB>x<TAB>y<TAB>x2<TAB>text
// (x/x2 = left/right edge, y = distance from the TOP of the page, in points). macOS PDFKit — nothing to install.
// Used by scripts/bank-statements.mjs, which needs the columns a plain text dump loses (Deposit vs Withdrawal).
import Foundation
import PDFKit

guard CommandLine.arguments.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write("cannot open PDF\n".data(using: .utf8)!)
    exit(1)
}
var out = ""
for p in 0..<doc.pageCount {
    guard let page = doc.page(at: p), let all = page.selection(for: page.bounds(for: .mediaBox)) else { continue }
    let height = page.bounds(for: .mediaBox).height
    for line in all.selectionsByLine() {
        let b = line.bounds(for: page)
        let t = (line.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { continue }
        out += "\(p + 1)\t\(Int(b.minX))\t\(Int(height - b.maxY))\t\(Int(b.maxX))\t\(t.replacingOccurrences(of: "\t", with: " "))\n"
    }
}
print(out, terminator: "")
