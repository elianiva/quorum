//! Source files and byte spans into them.

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FileId(pub u32);

/// A half-open byte range in one file.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Span {
    pub file: FileId,
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub fn new(file: FileId, start: usize, end: usize) -> Span {
        Span {
            file,
            start: start as u32,
            end: end as u32,
        }
    }

    /// The span from the start of `self` to the end of `other`, in the same file.
    pub fn to(self, other: Span) -> Span {
        Span {
            file: self.file,
            start: self.start,
            end: other.end.max(self.end),
        }
    }
}

pub struct SourceFile {
    pub name: String,
    pub text: String,
    /// The byte offset where each line starts.
    line_starts: Vec<usize>,
}

impl SourceFile {
    pub fn new(name: String, text: String) -> SourceFile {
        let mut line_starts = vec![0];
        line_starts.extend(text.match_indices('\n').map(|(i, _)| i + 1));
        SourceFile {
            name,
            text,
            line_starts,
        }
    }

    /// The 1-based line and 1-based column (in characters) of a byte offset.
    pub fn line_col(&self, offset: usize) -> (usize, usize) {
        let line = self.line_starts.partition_point(|&start| start <= offset) - 1;
        let column = self.text[self.line_starts[line]..offset].chars().count();
        (line + 1, column + 1)
    }

    /// The text of a 1-based line, without its line break.
    pub fn line(&self, line: usize) -> &str {
        let start = self.line_starts[line - 1];
        let end = self
            .line_starts
            .get(line)
            .map_or(self.text.len(), |&next| next - 1);
        self.text[start..end].trim_end_matches('\r')
    }
}

#[derive(Default)]
pub struct SourceMap {
    files: Vec<SourceFile>,
}

impl SourceMap {
    pub fn add(&mut self, name: impl Into<String>, text: impl Into<String>) -> FileId {
        self.files.push(SourceFile::new(name.into(), text.into()));
        FileId(self.files.len() as u32 - 1)
    }

    pub fn get(&self, id: FileId) -> &SourceFile {
        &self.files[id.0 as usize]
    }

    pub fn ids(&self) -> impl Iterator<Item = FileId> {
        (0..self.files.len() as u32).map(FileId)
    }

    pub fn slice(&self, span: Span) -> &str {
        &self.get(span.file).text[span.start as usize..span.end as usize]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_col_counts_characters_after_multibyte_text() {
        let file = SourceFile::new("a.qm".into(), "(a)\n\"é\" b\n".into());
        let b = file.text.find('b').unwrap();
        assert_eq!(file.line_col(b), (2, 5));
        assert_eq!(file.line(2), "\"é\" b");
        assert_eq!(file.line_col(0), (1, 1));
    }
}
