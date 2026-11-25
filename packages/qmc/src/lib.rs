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
pub mod data;
pub mod diag;
pub mod emit_rs;
pub mod emit_ts;
pub mod expand;
pub mod fmt;
pub mod graph;
pub mod lower;
pub mod num;
pub mod par;
pub mod reader;
pub mod sha256;
pub mod source;
pub mod tsval;

use diag::{Diagnostic, Sink};
use reader::Sexp;
use source::{FileId, SourceMap};
use std::path::{Path, PathBuf};

/// Every `.qm` file under `dir`, sorted, so declaration order is stable across runs.
pub fn qm_files(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let path = entry?.path();
            if path.is_dir() {
                walk(&path, out)?;
            } else if path.extension().is_some_and(|x| x == "qm") {
                out.push(path);
            }
        }
        Ok(())
    }
    let mut paths = Vec::new();
    walk(dir, &mut paths)?;
    paths.sort();
    Ok(paths)
}

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
    pub outputs: Vec<(String, String)>,
}

/// Reads, expands, lowers, checks, and emits the given files.
pub fn compile(inputs: Vec<(String, String)>) -> Compiled {
    let Expanded {
        sources,
        files,
        diagnostics,
    } = expand(inputs);
    let mut sink = Sink { items: diagnostics };
    let lowered = par::map(&files, |(id, forms)| {
        let name = &sources.get(*id).name;
        let file = name.rsplit(['/', '\\']).next().unwrap_or(name);
        lower::lower(forms, file.strip_suffix(".qm").unwrap_or(file))
    });
    let mut catalog = lower::Catalog::default();
    for (part, part_sink) in lowered {
        catalog.append(part);
        sink.extend(part_sink);
    }
    crate::data::rewrite(&mut catalog);
    sink.extend(check::run(&catalog));
    let outputs = if sink.has_errors() {
        Vec::new()
    } else {
        crate::data::resolve_eras(&mut catalog);
        let catalog = &catalog;
        let jobs: Vec<par::Job<'_, (&'static str, String)>> = vec![
            Box::new(move || ("constants.ts", emit_ts::constants(catalog))),
            Box::new(move || ("components.ts", emit_ts::components(catalog))),
            Box::new(move || ("eras.ts", emit_ts::eras(catalog))),
            Box::new(move || ("incidents.ts", emit_ts::incidents(catalog))),
            Box::new(move || ("kinds.ts", emit_ts::kinds(catalog))),
            Box::new(move || ("research.ts", emit_ts::research(catalog))),
        ];
        let mut outputs: Vec<(String, String)> = par::join_all(jobs)
            .into_iter()
            .map(|(name, text)| (name.to_string(), text))
            .collect();
        if !catalog.type_defs.is_empty() {
            outputs.push(("types.ts".into(), emit_ts::types(catalog)));
        }
        let mut modules: Vec<&str> = catalog
            .defs
            .iter()
            .map(|d| d.module.as_str())
            .chain(catalog.states.iter().map(|s| s.module.as_str()))
            .collect();
        modules.sort();
        modules.dedup();
        let bodies = par::map(&modules, |m| {
            let (needs, body) = data::module(catalog, m);
            let (state_needs, state_body) = emit_ts::states(catalog, m);
            let mut all = needs;
            all.extend(state_needs);
            (m.to_string(), all, format!("{body}{state_body}"))
        });
        for (module, needs, body) in bodies {
            let name = format!("{module}.ts");
            match outputs.iter_mut().find(|(n, _)| *n == name) {
                Some((_, text)) => {
                    *text = data::merge_imports(text, &needs);
                    text.push_str(&body);
                }
                None => {
                    let mut text = data::merge_imports(emit_ts::HEADER, &needs);
                    text.push_str(&body);
                    outputs.push((name, text));
                }
            }
            let (rule_needs, rule_body) = emit_ts::setters(catalog, &module);
            if !rule_body.is_empty() {
                let mut text = data::merge_imports(emit_ts::HEADER, &rule_needs);
                text.push_str(&rule_body);
                outputs.push((format!("{module}.rule.ts"), text));
            }
        }
        outputs
    };
    Compiled {
        sources,
        diagnostics: sink.sorted(),
        outputs,
    }
}
