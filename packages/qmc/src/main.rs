use qmc::diag::Severity;
use std::process::ExitCode;

const USAGE: &str = "usage: qmc expand <file.qm>…   print each file after macro expansion";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some((command, paths)) = args.split_first() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    if command != "expand" || paths.is_empty() {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    }
    let mut inputs = Vec::new();
    for path in paths {
        match std::fs::read_to_string(path) {
            Ok(text) => inputs.push((path.clone(), text)),
            Err(error) => {
                eprintln!("error: cannot read {path}: {error}");
                return ExitCode::FAILURE;
            }
        }
    }
    let result = qmc::expand(inputs);
    for diagnostic in &result.diagnostics {
        eprintln!("{}", diagnostic.render(&result.sources));
    }
    if result
        .diagnostics
        .iter()
        .any(|d| d.severity == Severity::Error)
    {
        return ExitCode::FAILURE;
    }
    for (_, forms) in &result.files {
        for form in forms {
            println!("{form}");
        }
    }
    ExitCode::SUCCESS
}
