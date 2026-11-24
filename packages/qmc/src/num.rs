//! Exact numbers with units.
//!
//! Every literal is a rational, so `(44% 35% 15% 6%)` sums to exactly 1 and the compiler never
//! needs an epsilon. Units carry a dimension: `2ms` is a time and cannot fill a share.

use std::cmp::Ordering;
use std::fmt;
use std::ops::{Add, Div, Mul};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Unit {
    None,
    /// `44%`, a share: 0.44.
    Percent,
    /// `1.15x`, a multiplier.
    Times,
    Ms,
    S,
    Min,
    H,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dimension {
    Plain,
    Share,
    Factor,
    Time,
}

impl Unit {
    pub fn dimension(self) -> Dimension {
        match self {
            Unit::None => Dimension::Plain,
            Unit::Percent => Dimension::Share,
            Unit::Times => Dimension::Factor,
            Unit::Ms | Unit::S | Unit::Min | Unit::H => Dimension::Time,
        }
    }

    /// The size of one unit in its dimension's base: shares in 1, times in seconds.
    fn scale(self) -> Ratio {
        match self {
            Unit::None | Unit::Times | Unit::S => Ratio::int(1),
            Unit::Percent => Ratio::new(1, 100),
            Unit::Ms => Ratio::new(1, 1000),
            Unit::Min => Ratio::int(60),
            Unit::H => Ratio::int(3600),
        }
    }

    fn suffix(self) -> &'static str {
        match self {
            Unit::None => "",
            Unit::Percent => "%",
            Unit::Times => "x",
            Unit::Ms => "ms",
            Unit::S => "s",
            Unit::Min => "min",
            Unit::H => "h",
        }
    }

    fn from_suffix(suffix: &str) -> Option<Unit> {
        Some(match suffix {
            "" => Unit::None,
            "%" => Unit::Percent,
            "x" => Unit::Times,
            "ms" => Unit::Ms,
            "s" => Unit::S,
            "min" => Unit::Min,
            "h" => Unit::H,
            _ => return None,
        })
    }
}

impl fmt::Display for Dimension {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Dimension::Plain => "a plain number",
            Dimension::Share => "a share (%)",
            Dimension::Factor => "a factor (x)",
            Dimension::Time => "a time (ms, s, min, h)",
        })
    }
}

/// A reduced fraction with a positive denominator.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Ratio {
    pub num: i128,
    pub den: i128,
}

fn gcd(mut a: i128, mut b: i128) -> i128 {
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a.abs()
}

impl Ratio {
    pub fn new(num: i128, den: i128) -> Ratio {
        assert!(den != 0, "zero denominator");
        let g = gcd(num, den).max(1);
        let sign = if den < 0 { -1 } else { 1 };
        Ratio {
            num: sign * num / g,
            den: sign * den / g,
        }
    }

    pub const fn int(n: i128) -> Ratio {
        Ratio { num: n, den: 1 }
    }

    pub fn is_int(self) -> bool {
        self.den == 1
    }

    /// The shortest decimal that is exactly this value, or `None` when it repeats (1/3).
    pub fn decimal(self) -> Option<String> {
        let mut den = self.den;
        while den % 2 == 0 {
            den /= 2;
        }
        while den % 5 == 0 {
            den /= 5;
        }
        if den != 1 {
            return None;
        }
        let sign = if self.num < 0 { "-" } else { "" };
        let (whole, mut rest) = (self.num.abs() / self.den, self.num.abs() % self.den);
        if rest == 0 {
            return Some(format!("{sign}{whole}"));
        }
        let mut digits = String::new();
        while rest != 0 {
            rest *= 10;
            digits.push(char::from(b'0' + (rest / self.den) as u8));
            rest %= self.den;
        }
        Some(format!("{sign}{whole}.{digits}"))
    }
}

impl Add for Ratio {
    type Output = Ratio;
    fn add(self, other: Ratio) -> Ratio {
        Ratio::new(
            self.num * other.den + other.num * self.den,
            self.den * other.den,
        )
    }
}

impl Mul for Ratio {
    type Output = Ratio;
    fn mul(self, other: Ratio) -> Ratio {
        Ratio::new(self.num * other.num, self.den * other.den)
    }
}

impl Div for Ratio {
    type Output = Ratio;
    fn div(self, other: Ratio) -> Ratio {
        Ratio::new(self.num * other.den, self.den * other.num)
    }
}

impl Ord for Ratio {
    fn cmp(&self, other: &Ratio) -> Ordering {
        (self.num * other.den).cmp(&(other.num * self.den))
    }
}

impl PartialOrd for Ratio {
    fn partial_cmp(&self, other: &Ratio) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Display for Ratio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.decimal() {
            Some(d) => f.write_str(&d),
            None => write!(f, "{}/{}", self.num, self.den),
        }
    }
}

/// A literal as written: its value in its own unit, and the unit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Number {
    pub value: Ratio,
    pub unit: Unit,
}

impl Number {
    pub fn int(n: i128, unit: Unit) -> Number {
        Number {
            value: Ratio::int(n),
            unit,
        }
    }

    pub fn parse(token: &str) -> Result<Number, String> {
        let clean: String = token.chars().filter(|&c| c != '_').collect();
        let split = clean
            .char_indices()
            .find(|&(i, c)| !(c.is_ascii_digit() || c == '.' || (i == 0 && (c == '-' || c == '+'))))
            .map_or(clean.len(), |(i, _)| i);
        let (digits, suffix) = clean.split_at(split);
        let unit = Unit::from_suffix(suffix).ok_or_else(|| format!("unknown unit `{suffix}`"))?;
        let (sign, digits) = match digits.as_bytes().first() {
            Some(b'-') => (-1, &digits[1..]),
            Some(b'+') => (1, &digits[1..]),
            _ => (1, digits),
        };
        let (whole, frac) = digits.split_once('.').unwrap_or((digits, ""));
        if whole.is_empty() || frac.contains('.') || (digits.contains('.') && frac.is_empty()) {
            return Err("expected digits like 12 or 1.5".into());
        }
        if whole.len() + frac.len() > 30 {
            return Err("too many digits".into());
        }
        let num: i128 = format!("{whole}{frac}")
            .parse()
            .map_err(|_| "expected digits".to_string())?;
        let den = 10i128.pow(frac.len() as u32);
        Ok(Number {
            value: Ratio::new(sign * num, den),
            unit,
        })
    }

    /// The value in its dimension's base unit: `44%` is 11/25 and `2ms` is 1/500 s.
    pub fn base(self) -> Ratio {
        self.value * self.unit.scale()
    }

    /// The value in `unit`, which must share this number's dimension.
    pub fn in_unit(self, unit: Unit) -> Ratio {
        debug_assert_eq!(self.unit.dimension(), unit.dimension());
        self.base() / unit.scale()
    }
}

impl fmt::Display for Number {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.value, self.unit.suffix())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percentages_sum_exactly() {
        let total = ["44%", "35%", "15%", "6%"]
            .iter()
            .map(|t| Number::parse(t).unwrap().base())
            .fold(Ratio::int(0), Ratio::add);
        assert_eq!(total, Ratio::int(1));
        let thirds = Ratio::new(1, 3) + Ratio::new(1, 3) + Ratio::new(1, 3);
        assert_eq!(thirds, Ratio::int(1));
    }

    #[test]
    fn parses_units_underscores_and_signs() {
        assert_eq!(
            Number::parse("5_000").unwrap(),
            Number::int(5000, Unit::None)
        );
        assert_eq!(Number::parse("1.15x").unwrap().value, Ratio::new(23, 20));
        assert_eq!(
            Number::parse("-2ms").unwrap().in_unit(Unit::S),
            Ratio::new(-1, 500)
        );
        assert_eq!(
            Number::parse("5min").unwrap().in_unit(Unit::S),
            Ratio::int(300)
        );
        assert!(Number::parse("2KB").unwrap_err().contains("unknown unit"));
        assert!(Number::parse("1.").is_err());
        assert!(Number::parse("1.2.3").is_err());
    }

    #[test]
    fn decimals_print_exactly_or_not_at_all() {
        assert_eq!(Ratio::new(23, 20).to_string(), "1.15");
        assert_eq!(Ratio::new(-1, 8).to_string(), "-0.125");
        assert_eq!(Ratio::new(1, 3).decimal(), None);
        assert_eq!(Number::parse("19%").unwrap().base().to_string(), "0.19");
    }
}
