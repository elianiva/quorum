//! Reads the values back out of the generated TypeScript, so the Solver's catalog is built from
//! the same code the Simulation runs.
//!
//! Generated modules hold only literals, names, spreads, property reads, and `+ - * /`, written
//! one statement per top-level line. The reader evaluates them as JavaScript would: numbers are
//! `f64`, arithmetic runs left to right in `f64`, and records keep their key order.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

#[derive(Clone, Debug, PartialEq)]
pub enum J {
    Num(f64),
    Str(String),
    Bool(bool),
    Null,
    Undefined,
    Arr(Vec<J>),
    Obj(Vec<(String, J)>),
}

impl J {
    /// A property, or `undefined` as JavaScript reads a missing one.
    pub fn get(&self, key: &str) -> &J {
        static UNDEFINED: J = J::Undefined;
        match self {
            J::Obj(entries) => entries
                .iter()
                .rev()
                .find(|(k, _)| k == key)
                .map_or(&UNDEFINED, |(_, v)| v),
            J::Arr(items) => key
                .parse::<usize>()
                .ok()
                .and_then(|i| items.get(i))
                .unwrap_or(&UNDEFINED),
            _ => &UNDEFINED,
        }
    }

    /// `a ?? b`.
    pub fn or<'a>(&'a self, other: &'a J) -> &'a J {
        match self {
            J::Null | J::Undefined => other,
            v => v,
        }
    }

    pub fn num(&self) -> Option<f64> {
        match self {
            J::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub fn items(&self) -> &[J] {
        match self {
            J::Arr(items) => items,
            _ => &[],
        }
    }

    /// `Object.keys`.
    pub fn keys(&self) -> Vec<String> {
        match self {
            J::Obj(entries) => {
                let mut out: Vec<String> = Vec::new();
                for (k, _) in entries {
                    if !out.contains(k) {
                        out.push(k.clone());
                    }
                }
                out
            }
            J::Arr(items) => (0..items.len()).map(|i| i.to_string()).collect(),
            _ => Vec::new(),
        }
    }

    /// `Object.values`.
    pub fn values(&self) -> Vec<&J> {
        match self {
            J::Obj(_) => self.keys().iter().map(|k| self.get(k)).collect(),
            J::Arr(items) => items.iter().collect(),
            _ => Vec::new(),
        }
    }

    pub fn str(&self) -> Option<&str> {
        match self {
            J::Str(s) => Some(s),
            _ => None,
        }
    }

    /// `typeof v === 'object'`, which is true of `null`.
    pub fn is_object(&self) -> bool {
        matches!(self, J::Null | J::Arr(_) | J::Obj(_))
    }
}

/// Every `export const` of the generated modules, evaluated on demand.
pub struct Env {
    exprs: BTreeMap<String, String>,
    memo: RefCell<BTreeMap<String, J>>,
    busy: RefCell<BTreeSet<String>>,
}

impl Env {
    /// Indexes the `export const` statements of each module's text.
    pub fn new<'a>(modules: impl IntoIterator<Item = &'a str>) -> Env {
        let mut exprs = BTreeMap::new();
        for text in modules {
            for stmt in statements(text) {
                if let Some((name, expr)) = declaration(stmt) {
                    exprs.insert(name.to_string(), expr.to_string());
                }
            }
        }
        Env {
            exprs,
            memo: RefCell::default(),
            busy: RefCell::default(),
        }
    }

    pub fn has(&self, name: &str) -> bool {
        self.exprs.contains_key(name)
    }

    /// The value of an exported name. Panics on a name no module exports, which is a bug in the
    /// emitter, not in content.
    pub fn get(&self, name: &str) -> J {
        if let Some(v) = self.memo.borrow().get(name) {
            return v.clone();
        }
        let expr = self
            .exprs
            .get(name)
            .unwrap_or_else(|| panic!("no generated module exports `{name}`"));
        assert!(
            self.busy.borrow_mut().insert(name.to_string()),
            "`{name}` reads itself"
        );
        let mut p = Parser {
            src: expr.as_bytes(),
            pos: 0,
            env: self,
        };
        let v = p.expr(0);
        self.busy.borrow_mut().remove(name);
        self.memo.borrow_mut().insert(name.to_string(), v.clone());
        v
    }
}

/// Splits a module into statements: each starts on a line with no indent.
fn statements(text: &str) -> Vec<&str> {
    let mut starts = Vec::new();
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        let first = line.as_bytes().first().copied().unwrap_or(b'\n');
        if !matches!(
            first,
            b' ' | b'\n' | b'}' | b']' | b')' | b'>' | b'|' | b'*'
        ) {
            starts.push(offset);
        }
        offset += line.len();
    }
    starts.push(text.len());
    starts.windows(2).map(|w| &text[w[0]..w[1]]).collect()
}

/// `export const NAME[: Type] = expr [as const] [satisfies Type]`: the name and the expression.
fn declaration(stmt: &str) -> Option<(&str, &str)> {
    let rest = stmt.strip_prefix("export const ")?;
    let end = rest.find(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$'))?;
    let name = &rest[..end];
    let rest = &rest[end..];
    // The ` = ` that ends the annotation, outside any brackets.
    let mut depth = 0i32;
    let bytes = rest.as_bytes();
    let mut eq = None;
    for i in 0..bytes.len() {
        match bytes[i] {
            b'<' | b'(' | b'[' | b'{' => depth += 1,
            b'>' if i == 0 || bytes[i - 1] != b'=' => depth -= 1,
            b')' | b']' | b'}' => depth -= 1,
            b'=' if depth == 0 && bytes.get(i + 1) != Some(&b'>') => {
                eq = Some(i);
                break;
            }
            _ => {}
        }
    }
    Some((name, rest[eq? + 1..].trim()))
}

struct Parser<'a> {
    src: &'a [u8],
    pos: usize,
    env: &'a Env,
}

impl Parser<'_> {
    fn ws(&mut self) {
        while self.pos < self.src.len() {
            if self.src[self.pos].is_ascii_whitespace() {
                self.pos += 1;
            } else if self.src[self.pos..].starts_with(b"//") {
                while self.pos < self.src.len() && self.src[self.pos] != b'\n' {
                    self.pos += 1;
                }
            } else {
                break;
            }
        }
    }

    fn peek(&mut self) -> u8 {
        self.ws();
        self.src.get(self.pos).copied().unwrap_or(0)
    }

    fn eat(&mut self, s: &str) -> bool {
        self.ws();
        if self.src[self.pos..].starts_with(s.as_bytes()) {
            self.pos += s.len();
            true
        } else {
            false
        }
    }

    fn expect(&mut self, s: &str) {
        assert!(self.eat(s), "expected `{s}` at {}", self.context());
    }

    fn context(&self) -> String {
        let end = (self.pos + 40).min(self.src.len());
        String::from_utf8_lossy(&self.src[self.pos..end]).into_owned()
    }

    fn ident(&mut self) -> String {
        self.ws();
        let start = self.pos;
        while self.pos < self.src.len()
            && (self.src[self.pos].is_ascii_alphanumeric()
                || matches!(self.src[self.pos], b'_' | b'$'))
        {
            self.pos += 1;
        }
        assert!(self.pos > start, "expected a name at {}", self.context());
        String::from_utf8(self.src[start..self.pos].to_vec()).unwrap()
    }

    fn string(&mut self) -> String {
        let quote = self.src[self.pos];
        self.pos += 1;
        let mut out = Vec::new();
        while self.src[self.pos] != quote {
            if self.src[self.pos] == b'\\' {
                self.pos += 1;
                out.push(match self.src[self.pos] {
                    b'n' => b'\n',
                    b't' => b'\t',
                    c => c,
                });
            } else {
                out.push(self.src[self.pos]);
            }
            self.pos += 1;
        }
        self.pos += 1;
        String::from_utf8(out).unwrap()
    }

    fn number(&mut self) -> f64 {
        let start = self.pos;
        while self.pos < self.src.len()
            && (self.src[self.pos].is_ascii_digit() || matches!(self.src[self.pos], b'.' | b'_'))
        {
            self.pos += 1;
        }
        let text: String = String::from_utf8_lossy(&self.src[start..self.pos])
            .chars()
            .filter(|&c| c != '_')
            .collect();
        text.parse().unwrap()
    }

    /// Skips a type after `as`, up to a `,`, a closer, an operator, or the end at depth 0.
    fn skip_type(&mut self) {
        let mut depth = 0i32;
        while self.pos < self.src.len() {
            let c = self.src[self.pos];
            match c {
                b'<' | b'(' | b'[' | b'{' => depth += 1,
                b'>' | b')' | b']' | b'}' if depth > 0 => depth -= 1,
                b',' | b')' | b']' | b'}' | b'+' | b'*' | b'/' | b'\n' if depth == 0 => return,
                b'-' if depth == 0 => return,
                _ => {}
            }
            self.pos += 1;
        }
    }

    fn expr(&mut self, min: u8) -> J {
        let mut left = self.unary();
        loop {
            let c = self.peek();
            let (op, prec) = match c {
                b'+' | b'-' => (c, 1),
                b'*' | b'/' => (c, 2),
                _ => break,
            };
            if prec < min.max(1) {
                break;
            }
            self.pos += 1;
            let right = self.expr(prec + 1);
            let (a, b) = (left.num().unwrap(), right.num().unwrap());
            left = J::Num(match op {
                b'+' => a + b,
                b'-' => a - b,
                b'*' => a * b,
                _ => a / b,
            });
        }
        left
    }

    fn unary(&mut self) -> J {
        if self.peek() == b'-' {
            self.pos += 1;
            let v = self.unary();
            return J::Num(-v.num().unwrap());
        }
        let mut v = self.primary();
        loop {
            self.ws();
            if self.src[self.pos..].starts_with(b"as ") {
                self.pos += 3;
                if !self.eat("const") {
                    self.skip_type();
                }
                continue;
            }
            break;
        }
        v = self.members(v);
        v
    }

    fn members(&mut self, mut v: J) -> J {
        loop {
            if self.peek() == b'.' && self.src.get(self.pos + 1) != Some(&b'.') {
                self.pos += 1;
                let k = self.ident();
                v = v.get(&k).clone();
            } else if self.peek() == b'[' {
                self.pos += 1;
                let k = match self.peek() {
                    b'\'' | b'"' => self.string(),
                    _ => (self.number() as usize).to_string(),
                };
                self.expect("]");
                v = v.get(&k).clone();
            } else {
                return v;
            }
        }
    }

    fn primary(&mut self) -> J {
        match self.peek() {
            b'(' => {
                self.pos += 1;
                let v = self.expr(0);
                self.expect(")");
                v
            }
            b'\'' | b'"' => J::Str(self.string()),
            b'0'..=b'9' => J::Num(self.number()),
            b'[' => {
                self.pos += 1;
                let mut items = Vec::new();
                while !self.eat("]") {
                    if self.eat("...") {
                        items.extend(self.expr(0).items().iter().cloned());
                    } else {
                        items.push(self.expr(0));
                    }
                    self.eat(",");
                }
                J::Arr(items)
            }
            b'{' => {
                self.pos += 1;
                let mut entries: Vec<(String, J)> = Vec::new();
                let set = |entries: &mut Vec<(String, J)>, k: String, v: J| match entries
                    .iter_mut()
                    .find(|(e, _)| *e == k)
                {
                    Some(slot) => slot.1 = v,
                    None => entries.push((k, v)),
                };
                while !self.eat("}") {
                    if self.eat("...") {
                        let v = self.expr(0);
                        for k in v.keys() {
                            let item = v.get(&k).clone();
                            set(&mut entries, k, item);
                        }
                    } else {
                        let k = match self.peek() {
                            b'\'' | b'"' => self.string(),
                            b'0'..=b'9' => {
                                let n = self.number();
                                format_number_plain(n)
                            }
                            _ => self.ident(),
                        };
                        self.expect(":");
                        let v = self.expr(0);
                        set(&mut entries, k, v);
                    }
                    self.eat(",");
                }
                J::Obj(entries)
            }
            _ => {
                let name = self.ident();
                match name.as_str() {
                    "true" => J::Bool(true),
                    "false" => J::Bool(false),
                    "null" => J::Null,
                    "undefined" => J::Undefined,
                    "Infinity" => J::Num(f64::INFINITY),
                    "Number" if self.eat(".POSITIVE_INFINITY") => J::Num(f64::INFINITY),
                    _ => self.env.get(&name),
                }
            }
        }
    }
}

/// JavaScript's `String(n)` for a number.
pub fn format_number_plain(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if n == 0.0 {
        return "0".into();
    }
    let sign = if n < 0.0 { "-" } else { "" };
    // Rust's `{:e}` gives the shortest digits that round-trip, as JavaScript does.
    let e = format!("{:e}", n.abs());
    let (mantissa, exp) = e.split_once('e').unwrap();
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i32;
    let n_exp = exp.parse::<i32>().unwrap() + 1;
    let body = if k <= n_exp && n_exp <= 21 {
        format!("{digits}{}", "0".repeat((n_exp - k) as usize))
    } else if 0 < n_exp && n_exp <= 21 {
        format!(
            "{}.{}",
            &digits[..n_exp as usize],
            &digits[n_exp as usize..]
        )
    } else if -6 < n_exp && n_exp <= 0 {
        format!("0.{}{digits}", "0".repeat((-n_exp) as usize))
    } else {
        let e = n_exp - 1;
        let sign = if e < 0 { '-' } else { '+' };
        if k == 1 {
            format!("{digits}e{sign}{}", e.abs())
        } else {
            format!("{}.{}e{sign}{}", &digits[..1], &digits[1..], e.abs())
        }
    };
    format!("{sign}{body}")
}

/// The names a TypeScript module exports, following `export *` and `export { … } from` to the
/// files they name. Local declarations count too.
pub fn namespace(entry: &Path) -> std::io::Result<BTreeSet<String>> {
    let mut out = BTreeSet::new();
    let mut seen = BTreeSet::new();
    walk(entry, &mut out, &mut seen)?;
    Ok(out)
}

fn walk(
    file: &Path,
    out: &mut BTreeSet<String>,
    seen: &mut BTreeSet<std::path::PathBuf>,
) -> std::io::Result<()> {
    if !seen.insert(file.to_path_buf()) {
        return Ok(());
    }
    let text = std::fs::read_to_string(file)?;
    let dir = file.parent().unwrap_or(Path::new("."));
    for stmt in statements(&text) {
        let Some(rest) = stmt.strip_prefix("export ") else {
            continue;
        };
        if let Some(from) = rest.strip_prefix("* from ") {
            let path = from.trim().trim_matches(|c| c == '\'' || c == '"');
            walk(&dir.join(path), out, seen)?;
        } else if let Some(list) = rest.strip_prefix('{') {
            let (names, _) = list.split_once('}').unwrap_or((list, ""));
            for name in names.split(',') {
                let name = name.trim();
                if name.is_empty() || name.starts_with("type ") {
                    continue;
                }
                let name = name.rsplit(" as ").next().unwrap();
                out.insert(name.trim().to_string());
            }
        } else {
            for kw in ["const ", "function ", "let "] {
                if let Some(decl) = rest.strip_prefix(kw) {
                    let end = decl
                        .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$'))
                        .unwrap_or(decl.len());
                    out.insert(decl[..end].to_string());
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_print_as_javascript_prints_them() {
        for (n, s) in [
            (0.1 + 0.2, "0.30000000000000004"),
            (1e21, "1e+21"),
            (1e-7, "1e-7"),
            (0.000001, "0.000001"),
            (123456789.5, "123456789.5"),
            (-2.5e-8, "-2.5e-8"),
            (1.5e300, "1.5e+300"),
            (100.0, "100"),
        ] {
            assert_eq!(format_number_plain(n), s);
        }
    }

    #[test]
    fn modules_evaluate_as_javascript_does() {
        let a = "// header\nimport type { T } from './t.ts'\n\nexport type X = Readonly<{\n  a: number\n}>\n\nexport const BASE = 0.1\nexport const M: Record<string, T> = {\n  a: { n: BASE * 3, s: 'it\\'s' },\n  'b-c': [...LIST, 'z'],\n}\n";
        let b = "export const LIST = ['x', 'y'] as const\nexport const R = { ...M, a: 1 - (2 - 3), d: M['b-c'][2] }\n";
        let env = Env::new([a, b]);
        assert_eq!(env.get("M").get("a").get("n"), &J::Num(0.1 * 3.0));
        assert_eq!(env.get("M").get("a").get("s"), &J::Str("it's".into()));
        let r = env.get("R");
        assert_eq!(r.keys(), ["a", "b-c", "d"]);
        assert_eq!(r.get("a"), &J::Num(2.0));
        assert_eq!(r.get("d"), &J::Str("z".into()));
    }
}
