//! Graph checks on name graphs: cycles and transitive reach.

use std::collections::{BTreeMap, BTreeSet};

/// One concrete cycle per strongly connected component that has one, as a path that starts at
/// the component's smallest name. The result is sorted, so it never depends on map order.
pub fn cycles(graph: &BTreeMap<String, Vec<String>>) -> Vec<Vec<String>> {
    let mut out = Vec::new();
    for component in tarjan(graph) {
        let looped = component.len() > 1
            || graph
                .get(&component[0])
                .is_some_and(|e| e.contains(&component[0]));
        if !looped {
            continue;
        }
        let members: BTreeSet<&String> = component.iter().collect();
        let start = component.iter().min().unwrap();
        out.push(path_back(graph, start, &members));
    }
    out.sort();
    out
}

/// A path from `start` back to itself inside one component, found by breadth-first search so it
/// is the shortest such loop.
fn path_back(
    graph: &BTreeMap<String, Vec<String>>,
    start: &String,
    members: &BTreeSet<&String>,
) -> Vec<String> {
    let mut parent: BTreeMap<&String, &String> = BTreeMap::new();
    let mut queue = std::collections::VecDeque::from([start]);
    while let Some(node) = queue.pop_front() {
        for next in graph.get(node).into_iter().flatten() {
            if !members.contains(next) {
                continue;
            }
            if next == start {
                let mut path = vec![node.clone()];
                let mut at = node;
                while at != start {
                    at = parent[at];
                    path.push(at.clone());
                }
                path.reverse();
                return path;
            }
            if !parent.contains_key(next) {
                parent.insert(next, node);
                queue.push_back(next);
            }
        }
    }
    vec![start.clone()]
}

/// Strongly connected components, iterative so a deep chain cannot overflow the stack.
fn tarjan(graph: &BTreeMap<String, Vec<String>>) -> Vec<Vec<String>> {
    let names: Vec<&String> = graph.keys().collect();
    let index_of: BTreeMap<&String, usize> =
        names.iter().enumerate().map(|(i, n)| (*n, i)).collect();
    let edges: Vec<Vec<usize>> = names
        .iter()
        .map(|n| {
            graph[*n]
                .iter()
                .filter_map(|m| index_of.get(m).copied())
                .collect()
        })
        .collect();
    let n = names.len();
    let (mut index, mut low, mut on_stack) = (vec![usize::MAX; n], vec![0; n], vec![false; n]);
    let (mut stack, mut counter, mut out) = (Vec::new(), 0, Vec::new());
    for root in 0..n {
        if index[root] != usize::MAX {
            continue;
        }
        let mut work = vec![(root, 0usize)];
        while let Some(&mut (v, ref mut edge)) = work.last_mut() {
            if *edge == 0 {
                index[v] = counter;
                low[v] = counter;
                counter += 1;
                stack.push(v);
                on_stack[v] = true;
            }
            if let Some(&w) = edges[v].get(*edge) {
                *edge += 1;
                if index[w] == usize::MAX {
                    work.push((w, 0));
                } else if on_stack[w] {
                    low[v] = low[v].min(index[w]);
                }
                continue;
            }
            work.pop();
            if let Some(&(parent, _)) = work.last() {
                low[parent] = low[parent].min(low[v]);
            }
            if low[v] == index[v] {
                let mut component = Vec::new();
                loop {
                    let w = stack.pop().unwrap();
                    on_stack[w] = false;
                    component.push(names[w].clone());
                    if w == v {
                        break;
                    }
                }
                out.push(component);
            }
        }
    }
    out
}

/// Every name reachable from `start` by one or more edges.
pub fn reach<'a>(graph: &'a BTreeMap<String, Vec<String>>, start: &str) -> BTreeSet<&'a str> {
    let mut seen = BTreeSet::new();
    let mut todo: Vec<&str> = graph
        .get(start)
        .into_iter()
        .flatten()
        .map(String::as_str)
        .collect();
    while let Some(node) = todo.pop() {
        if seen.insert(node) {
            todo.extend(graph.get(node).into_iter().flatten().map(String::as_str));
        }
    }
    seen
}

#[cfg(test)]
mod tests {
    use super::*;

    fn g(edges: &[(&str, &[&str])]) -> BTreeMap<String, Vec<String>> {
        edges
            .iter()
            .map(|(k, v)| (k.to_string(), v.iter().map(|s| s.to_string()).collect()))
            .collect()
    }

    #[test]
    fn finds_each_loop_once_as_a_shortest_path() {
        let graph = g(&[
            ("a", &["b"]),
            ("b", &["c", "a"]),
            ("c", &["a"]),
            ("d", &["d"]),
            ("e", &["a"]),
        ]);
        assert_eq!(cycles(&graph), [vec!["a", "b"], vec!["d"]]);
    }

    #[test]
    fn an_acyclic_graph_has_no_cycles_and_reach_is_transitive() {
        let graph = g(&[("a", &["b"]), ("b", &["c"]), ("c", &[])]);
        assert!(cycles(&graph).is_empty());
        assert_eq!(
            reach(&graph, "a").into_iter().collect::<Vec<_>>(),
            ["b", "c"]
        );
    }

    #[test]
    fn a_long_chain_does_not_overflow() {
        let mut graph = BTreeMap::new();
        for i in 0..200_000 {
            graph.insert(format!("n{i}"), vec![format!("n{}", i + 1)]);
        }
        graph.insert("n200000".into(), vec!["n0".into()]);
        assert_eq!(cycles(&graph)[0].len(), 200_001);
    }
}
