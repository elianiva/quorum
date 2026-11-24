//! Diagnostics, rendered in the rustc style with a caret under the span.

use crate::source::{SourceMap, Span};
use std::fmt::Write;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Clone, Debug)]
pub struct Diagnostic {
    pub severity: Severity,
    /// A short stable name, such as `research-cycle`, that `(allow …)` can name.
    pub code: &'static str,
    pub message: String,
    pub span: Span,
    pub label: String,
    /// Secondary spans, such as "defined here".
    pub notes: Vec<(Span, String)>,
    pub help: Option<String>,
}

impl Diagnostic {
    pub fn error(code: &'static str, span: Span, message: impl Into<String>) -> Diagnostic {
        Diagnostic {
            severity: Severity::Error,
            code,
            message: message.into(),
            span,
            label: String::new(),
            notes: Vec::new(),
            help: None,
        }
    }

    pub fn warning(code: &'static str, span: Span, message: impl Into<String>) -> Diagnostic {
        Diagnostic {
            severity: Severity::Warning,
            ..Diagnostic::error(code, span, message)
        }
    }

    pub fn label(mut self, label: impl Into<String>) -> Diagnostic {
        self.label = label.into();
        self
    }

    pub fn note(mut self, span: Span, text: impl Into<String>) -> Diagnostic {
        self.notes.push((span, text.into()));
        self
    }

    pub fn help(mut self, text: impl Into<String>) -> Diagnostic {
        self.help = Some(text.into());
        self
    }

    /// The order diagnostics print in: by file, then position, then code. It does not depend on
    /// which thread found them.
    pub fn sort_key(&self) -> (Span, &'static str, &str) {
        (self.span, self.code, &self.message)
    }

    pub fn render(&self, sources: &SourceMap) -> String {
        let mut out = String::new();
        let kind = match self.severity {
            Severity::Error => "error",
            Severity::Warning => "warning",
        };
        let _ = writeln!(out, "{kind}[{}]: {}", self.code, self.message);
        snippet(&mut out, sources, self.span, &self.label, '^');
        for (span, text) in &self.notes {
            snippet(&mut out, sources, *span, text, '-');
        }
        if let Some(help) = &self.help {
            let _ = writeln!(out, "  = help: {help}");
        }
        out
    }
}

fn snippet(out: &mut String, sources: &SourceMap, span: Span, label: &str, mark: char) {
    let file = sources.get(span.file);
    let (line, col) = file.line_col(span.start as usize);
    let (end_line, end_col) = file.line_col(span.end as usize);
    let gutter = line.to_string().len();
    let pad = " ".repeat(gutter);
    let _ = writeln!(out, "{pad}--> {}:{line}:{col}", file.name);
    let _ = writeln!(out, "{pad} |");
    let text = file.line(line);
    let _ = writeln!(out, "{line} | {text}");
    let width = if end_line == line {
        (end_col - col).max(1)
    } else {
        (text.chars().count() + 1 - col).max(1)
    };
    let marks: String = std::iter::repeat_n(mark, width).collect();
    let space = " ".repeat(col - 1);
    if label.is_empty() {
        let _ = writeln!(out, "{pad} | {space}{marks}");
    } else {
        let _ = writeln!(out, "{pad} | {space}{marks} {label}");
    }
}

/// Diagnostics from one pass. Each pass owns its sink, so threads never share one.
#[derive(Default)]
pub struct Sink {
    pub items: Vec<Diagnostic>,
}

impl Sink {
    pub fn push(&mut self, diagnostic: Diagnostic) {
        self.items.push(diagnostic);
    }

    pub fn has_errors(&self) -> bool {
        self.items.iter().any(|d| d.severity == Severity::Error)
    }

    pub fn extend(&mut self, other: Sink) {
        self.items.extend(other.items);
    }

    pub fn sorted(mut self) -> Vec<Diagnostic> {
        self.items.sort_by(|a, b| a.sort_key().cmp(&b.sort_key()));
        self.items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_a_caret_under_the_span_and_a_note() {
        let mut sources = SourceMap::default();
        let file = sources.add("research.qm", "(research a\n  :requires (b))\n");
        let b = Span::new(file, 25, 26);
        let a = Span::new(file, 10, 11);
        let text = Diagnostic::error("unknown-id", b, "no research is named `b`")
            .label("not defined")
            .note(a, "required by this research")
            .render(&sources);
        assert_eq!(
            text,
            "error[unknown-id]: no research is named `b`\n \
             --> research.qm:2:14\n  |\n2 |   :requires (b))\n  |              ^ not defined\n \
             --> research.qm:1:11\n  |\n1 | (research a\n  |           - required by this research\n"
        );
    }
}
