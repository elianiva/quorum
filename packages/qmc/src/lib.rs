//! qmc compiles Quorum's content files (`.qm`) into the Simulation's catalog.
//!
//! The passes, in order:
//!
//! 1. read: each file to S-expressions, in parallel
//! 2. collect macros from every file, then expand each file, in parallel
//! 3. lower: the expanded forms to typed entries
//! 4. check: every rule pass at once over the shared catalog
//! 5. emit: the generated files, at once
//!
//! Each pass keeps going after an error, so one run reports every problem it can. Diagnostics are
//! sorted by position before they print, and output is written in declaration order, so the
//! result never depends on which thread finished first.

pub mod check;
pub mod diag;
pub mod emit_ts;
pub mod expand;
pub mod graph;
pub mod lower;
pub mod num;
pub mod par;
pub mod reader;
pub mod source;

use diag::{Diagnostic, Sink};
use reader::Sexp;
use source::{FileId, SourceMap};

pub struct Expanded {
    pub sources: SourceMap,
    /// Each file's top-level forms after expansion, in file order.
    pub files: Vec<(FileId, Vec<Sexp>)>,
    pub diagnostics: Vec<Diagnostic>,
}

/// Reads and expands the given files.
pub fn expand(inputs: Vec<(String, String)>) -> Expanded {
    let mut sources = SourceMap::default();
    let ids: Vec<FileId> = inputs
        .into_iter()
        .map(|(name, text)| sources.add(name, text))
        .collect();
    let read: Vec<(Vec<Sexp>, Sink)> =
        par::map(&ids, |&id| reader::read(id, &sources.get(id).text));
    let mut sink = Sink::default();
    let mut forms = Vec::with_capacity(read.len());
    for (file_forms, file_sink) in read {
        forms.push(file_forms);
        sink.extend(file_sink);
    }
    let macros = expand::collect(&forms, &mut sink);
    let expanded = par::map(&forms, |file_forms| macros.expand_file(file_forms));
    let mut files = Vec::with_capacity(expanded.len());
    for (id, (file_forms, file_sink)) in ids.into_iter().zip(expanded) {
        files.push((id, file_forms));
        sink.extend(file_sink);
    }
    Expanded {
        sources,
        files,
        diagnostics: sink.sorted(),
    }
}

pub struct Compiled {
    pub sources: SourceMap,
    pub diagnostics: Vec<Diagnostic>,
    /// Each generated file, by its name in the output directory. Empty when there were errors.
    pub outputs: Vec<(&'static str, String)>,
}

/// Reads, expands, lowers, checks, and emits the given files.
pub fn compile(inputs: Vec<(String, String)>) -> Compiled {
    let Expanded {
        sources,
        files,
        diagnostics,
    } = expand(inputs);
    let mut sink = Sink { items: diagnostics };
    let lowered = par::map(&files, |(_, forms)| lower::lower(forms));
    let mut catalog = lower::Catalog::default();
    for (part, part_sink) in lowered {
        catalog.append(part);
        sink.extend(part_sink);
    }
    sink.extend(check::run(&catalog));
    let outputs = if sink.has_errors() {
        Vec::new()
    } else {
        let catalog = &catalog;
        let jobs: Vec<par::Job<'_, (&'static str, String)>> = vec![
            Box::new(move || ("eras.ts", emit_ts::eras(catalog))),
            Box::new(move || ("research.ts", emit_ts::research(catalog))),
        ];
        par::join_all(jobs)
    };
    Compiled {
        sources,
        diagnostics: sink.sorted(),
        outputs,
    }
}
