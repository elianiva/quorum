use qmc::diag::{Diagnostic, Severity};
use qmc::source::SourceMap;
use std::path::Path;
use std::process::ExitCode;

const USAGE: &str = "usage:
  qmc build <content dir> <generated dir> [--solver <catalog.ts> <catalog.rs>]
      compile every .qm file into the generated dir. --solver also writes the Solver's catalog.rs
      from the scalars catalog.ts exports.
  qmc expand <file.qm>…
      print each file after macro expansion";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    match args.as_slice() {
        ["build", content, out, rest @ ..] => {
            let solver = rest
                .iter()
                .position(|a| *a == "--solver")
                .and_then(|i| Some((Path::new(rest.get(i + 1)?), Path::new(rest.get(i + 2)?))));
            let known = rest.len() == if solver.is_some() { 3 } else { 0 };
            if !known {
                eprintln!("{USAGE}");
                return ExitCode::from(2);
            }
            build(Path::new(content), Path::new(out), solver)
        }
        ["expand", paths @ ..] if !paths.is_empty() => expand(paths),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn read(paths: &[&Path]) -> Result<Vec<(String, String)>, ExitCode> {
    paths
        .iter()
        .map(|path| match std::fs::read_to_string(path) {
            Ok(text) => Ok((path.display().to_string(), text)),
            Err(error) => {
                eprintln!("error: cannot read {}: {error}", path.display());
                Err(ExitCode::FAILURE)
            }
        })
        .collect()
}

/// Prints diagnostics and a summary. Returns true when there were errors.
fn report(diagnostics: &[Diagnostic], sources: &SourceMap) -> bool {
    for d in diagnostics {
        eprintln!("{}", d.render(sources));
    }
    let errors = diagnostics
        .iter()
        .filter(|d| d.severity == Severity::Error)
        .count();
    let warnings = diagnostics.len() - errors;
    if errors + warnings > 0 {
        eprintln!("qmc: {errors} error(s), {warnings} warning(s)");
    }
    errors > 0
}

fn build(content: &Path, out: &Path, solver: Option<(&Path, &Path)>) -> ExitCode {
    let mut paths = match std::fs::read_dir(content) {
        Ok(entries) => entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "qm"))
            .collect::<Vec<_>>(),
        Err(error) => {
            eprintln!("error: cannot read {}: {error}", content.display());
            return ExitCode::FAILURE;
        }
    };
    paths.sort();
    let inputs = match read(&paths.iter().map(|p| p.as_path()).collect::<Vec<_>>()) {
        Ok(inputs) => inputs,
        Err(code) => return code,
    };
    let compiled = qmc::compile(inputs);
    if report(&compiled.diagnostics, &compiled.sources) {
        return ExitCode::FAILURE;
    }
    let mut outputs: Vec<(std::path::PathBuf, String)> = compiled
        .outputs
        .iter()
        .map(|(name, text)| (out.join(name), text.clone()))
        .collect();
    if let Some((namespace, target)) = solver {
        let names = match qmc::tsval::namespace(namespace) {
            Ok(names) => names,
            Err(error) => {
                eprintln!("error: cannot read {}: {error}", namespace.display());
                return ExitCode::FAILURE;
            }
        };
        let modules: Vec<&str> = compiled.outputs.iter().map(|(_, t)| t.as_str()).collect();
        outputs.push((
            target.to_path_buf(),
            qmc::emit_rs::catalog(&modules, &names),
        ));
    }
    // An unchanged file is not rewritten, so a dev server does not reload for nothing.
    for (path, text) in &outputs {
        if std::fs::read_to_string(path).ok().as_deref() == Some(text.as_str()) {
            continue;
        }
        if let Err(error) = std::fs::create_dir_all(path.parent().unwrap_or(out))
            .and_then(|()| std::fs::write(path, text))
        {
            eprintln!("error: cannot write {}: {error}", path.display());
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

fn expand(paths: &[&str]) -> ExitCode {
    let inputs = match read(&paths.iter().map(Path::new).collect::<Vec<_>>()) {
        Ok(inputs) => inputs,
        Err(code) => return code,
    };
    let result = qmc::expand(inputs);
    if report(&result.diagnostics, &result.sources) {
        return ExitCode::FAILURE;
    }
    for (_, forms) in &result.files {
        for form in forms {
            println!("{form}");
        }
    }
    ExitCode::SUCCESS
}
