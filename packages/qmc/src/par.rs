//! A scoped thread pool on std alone.
//!
//! `map` hands items to workers through one atomic index, so a slow item does not hold up a
//! thread's whole share, and writes each result into its item's slot. The output order is the
//! input order, whatever order the threads finish in, so the compiler's bytes never depend on
//! scheduling.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;

/// The number of worker threads: `QMC_THREADS` when set, else the machine's parallelism.
pub fn threads() -> usize {
    std::env::var("QMC_THREADS")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|&n| n > 0)
        .unwrap_or_else(|| thread::available_parallelism().map_or(1, |n| n.get()))
}

pub fn map<T: Sync, R: Send>(items: &[T], f: impl Fn(&T) -> R + Sync) -> Vec<R> {
    let workers = threads().min(items.len());
    if workers <= 1 {
        return items.iter().map(f).collect();
    }
    let next = AtomicUsize::new(0);
    let slots: Vec<Mutex<Option<R>>> = items.iter().map(|_| Mutex::new(None)).collect();
    thread::scope(|scope| {
        for _ in 0..workers {
            scope.spawn(|| loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                let Some(item) = items.get(i) else { break };
                let result = f(item);
                *slots[i].lock().unwrap() = Some(result);
            });
        }
    });
    slots
        .into_iter()
        .map(|slot| slot.into_inner().unwrap().expect("every slot is filled"))
        .collect()
}

pub type Job<'a, R> = Box<dyn FnOnce() -> R + Send + 'a>;

/// Runs independent jobs at once and returns their results in the order given.
pub fn join_all<R: Send>(jobs: Vec<Job<'_, R>>) -> Vec<R> {
    let jobs: Vec<Mutex<Option<Job<'_, R>>>> =
        jobs.into_iter().map(|job| Mutex::new(Some(job))).collect();
    map(&jobs, |job| {
        (job.lock().unwrap().take().expect("each job runs once"))()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_input_order_when_late_items_finish_first() {
        let items: Vec<u64> = (0..64).collect();
        let out = map(&items, |&i| {
            // Early items sleep longest, so they finish last.
            thread::sleep(std::time::Duration::from_micros((64 - i) * 50));
            i * 2
        });
        assert_eq!(out, (0..64).map(|i| i * 2).collect::<Vec<_>>());
    }

    #[test]
    fn join_all_returns_results_in_job_order() {
        let a = String::from("a");
        let out = join_all(vec![
            Box::new(|| a.clone() + "1"),
            Box::new(|| "b2".to_string()),
        ]);
        assert_eq!(out, ["a1", "b2"]);
    }
}
